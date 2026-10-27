import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import type { Account, AuthProviders } from '@kapital/protocol';
import { type Db, type Provider, type User } from './db.js';
import { codeEmailHtml, type Mailer } from './mail.js';
import { checkPassword, hashPassword, randomToken, sameString } from './vault.js';

export interface OAuthApp {
  id: string;
  secret: string;
}

export interface AuthOptions {
  mailer?: Mailer | null;
  google?: OAuthApp | null;
  yandex?: OAuthApp | null;
  /** Токен бота и его имя: без них вход через Telegram не показывается. */
  telegram?: { token: string; botName: string } | null;
  /** Адрес сайта для возврата после OAuth, например https://kapital.example.com. */
  publicUrl?: string | null;
  fetch?: typeof fetch;
}

export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: string; status?: number };
const ok = <T>(value: T): AuthResult<T> => ({ ok: true, value });
const err = (error: string, status = 400): AuthResult<never> => ({ ok: false, error, status });

/** Что видит о себе вошедший игрок. */
export type Me = Account;

export const SESSION_TTL_MS = 90 * 24 * 3600_000;
const CODE_TTL_MS = 10 * 60_000;
const CODE_ATTEMPTS = 5;
const TICKET_TTL_MS = 60_000;
const NAME_MAX = 24;
const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Скользящее окно: не больше limit событий за windowMs по ключу. */
class RateLimit {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number) {}

  take(key: string): boolean {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => x > t - this.windowMs);
    if (list.length >= this.limit) return false;
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.clear();
    return true;
  }
}

/**
 * Аккаунты и способы входа. Сессия — случайный токен в cookie, в базе только его хэш.
 * Для игровой комнаты выдаётся короткий билет, чтобы cookie не попадала в адрес WebSocket.
 */
export class Auth {
  private readonly opts: AuthOptions;
  private readonly tickets = new Map<string, { userId: string; until: number }>();
  private readonly codeByEmail: RateLimit;
  private readonly codeByIp: RateLimit;
  private readonly passwordByKey: RateLimit;

  constructor(readonly db: Db, opts: AuthOptions = {}, private readonly now: () => number = Date.now) {
    this.opts = opts;
    this.codeByEmail = new RateLimit(3, 10 * 60_000, now);
    this.codeByIp = new RateLimit(15, 10 * 60_000, now);
    this.passwordByKey = new RateLimit(10, 15 * 60_000, now);
  }

  /** Какие способы входа настроены: клиент показывает только их. */
  providers(): AuthProviders {
    return {
      email: !!this.opts.mailer,
      google: !!this.opts.google,
      yandex: !!this.opts.yandex,
      telegram: this.opts.telegram?.botName ?? null,
    };
  }

  me(user: User): Me {
    return {
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
      logins: this.db.logins(user.id),
      hasPassword: this.db.passwordHash(user.id) !== null,
    };
  }

  // --- сессии и билеты ---

  userFromSession(token: string | null | undefined): User | null {
    return token ? this.db.sessionUser(token) : null;
  }

  startSession(userId: string): string {
    const token = randomToken();
    this.db.createSession(userId, token, SESSION_TTL_MS);
    return token;
  }

  endSession(token: string) {
    this.db.dropSession(token);
  }

  /** Билет на одно подключение к комнате: живёт минуту и сгорает при использовании. */
  ticket(userId: string): string {
    const t = randomToken(24);
    for (const [k, v] of this.tickets) if (v.until <= this.now()) this.tickets.delete(k);
    this.tickets.set(t, { userId, until: this.now() + TICKET_TTL_MS });
    return t;
  }

  userFromTicket(ticket: string | null | undefined): User | null {
    if (!ticket) return null;
    const t = this.tickets.get(ticket);
    if (!t) return null;
    this.tickets.delete(ticket);
    return t.until > this.now() ? this.db.user(t.userId) : null;
  }

  // --- почта: код из письма, при желании пароль ---

  async sendCode(email: string, ip: string): Promise<AuthResult<void>> {
    const mailer = this.opts.mailer;
    if (!mailer) return err('Вход по почте не настроен', 503);
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean) || clean.length > 254) return err('Похоже, это не адрес почты');
    if (!this.codeByIp.take(ip) || !this.codeByEmail.take(clean)) return err('Слишком много писем, попробуйте через несколько минут', 429);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.db.putCode(this.db.emailSubject(clean), code, CODE_TTL_MS);
    await mailer.send(clean, `${code} — код для входа в «Капитал»`,
      `Ваш код для входа: ${code}\n\nОн действует 10 минут. Если вы не запрашивали код, просто не обращайте внимания на это письмо.`,
      this.opts.publicUrl ? codeEmailHtml(this.opts.publicUrl, code) : undefined);
    return ok(undefined);
  }

  /**
   * Проверка кода. Если аккаунта с такой почтой нет, нужно имя: без него отвечаем needName.
   * Вошедший пользователь (current) привязывает почту к своему аккаунту.
   */
  verifyCode(email: string, code: string, name: string | undefined, password: string | undefined, current: User | null):
    AuthResult<{ user: User } | { needName: true }> {
    const clean = email.trim().toLowerCase();
    const subject = this.db.emailSubject(clean);
    if (!/^\d{6}$/.test(code)) return err('Код — шесть цифр');
    if (!this.db.takeCode(subject, code, CODE_ATTEMPTS)) return err('Код неверный или устарел');
    const existing = this.db.userIdByLogin('email', subject);
    let user: User;
    if (existing) {
      user = this.db.user(existing)!;
    } else if (current) {
      this.db.addLogin(current.id, 'email', subject, clean);
      this.db.setEmail(current.id, clean);
      user = this.db.user(current.id)!;
    } else {
      const cleanName = cleanUserName(name);
      if (!cleanName) {
        // код уже сгорел, поэтому выдаём новый на тот же адрес без письма: имя спросят сейчас же
        this.db.putCode(subject, code, CODE_TTL_MS);
        return ok({ needName: true });
      }
      user = this.db.createUser(randomUUID(), cleanName, clean);
      this.db.addLogin(user.id, 'email', subject, clean);
    }
    if (password !== undefined && password !== '') {
      const r = this.setPassword(user.id, password);
      if (!r.ok) return r;
    }
    return ok({ user });
  }

  signInWithPassword(email: string, password: string, ip: string): AuthResult<User> {
    const clean = email.trim().toLowerCase();
    if (!this.passwordByKey.take(`${ip}:${clean}`)) return err('Слишком много попыток, подождите немного', 429);
    const userId = this.db.userIdByLogin('email', this.db.emailSubject(clean));
    const hash = userId ? this.db.passwordHash(userId) : null;
    // при неизвестной почте тоже считаем хэш, чтобы по времени ответа нельзя было угадать, есть ли аккаунт
    if (!hash || !checkPassword(password, hash)) {
      if (!hash) checkPassword(password, DUMMY_HASH);
      return err('Неверная почта или пароль', 401);
    }
    return ok(this.db.user(userId!)!);
  }

  setPassword(userId: string, password: string): AuthResult<void> {
    if (password.length < PASSWORD_MIN) return err(`Пароль не короче ${PASSWORD_MIN} символов`);
    if (password.length > 200) return err('Слишком длинный пароль');
    this.db.setPasswordHash(userId, hashPassword(password));
    return ok(undefined);
  }

  rename(userId: string, name: string): AuthResult<User> {
    const clean = cleanUserName(name);
    if (!clean) return err('Нужно имя до 24 символов');
    this.db.rename(userId, clean);
    return ok(this.db.user(userId)!);
  }

  // --- внешние провайдеры ---

  /** Адрес, куда отправить пользователя для входа. State хранится в cookie и сверяется в callback. */
  oauthStart(provider: 'google' | 'yandex', origin: string, state: string): AuthResult<string> {
    const app = this.opts[provider];
    if (!app) return err('Этот способ входа не настроен', 503);
    const redirect = this.redirectUri(provider, origin);
    const url = provider === 'google'
      ? new URL('https://accounts.google.com/o/oauth2/v2/auth')
      : new URL('https://oauth.yandex.ru/authorize');
    url.searchParams.set('client_id', app.id);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    if (provider === 'google') url.searchParams.set('scope', 'openid email profile');
    return ok(url.toString());
  }

  /** Обмен кода на профиль и вход (или привязка к текущему аккаунту). */
  async oauthFinish(provider: 'google' | 'yandex', origin: string, code: string, current: User | null): Promise<AuthResult<User>> {
    const app = this.opts[provider];
    if (!app) return err('Этот способ входа не настроен', 503);
    const f = this.opts.fetch ?? fetch;
    const tokenUrl = provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://oauth.yandex.ru/token';
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: app.id, client_secret: app.secret,
      redirect_uri: this.redirectUri(provider, origin),
    });
    let profile: { subject: string; name: string; email: string | null };
    try {
      const tr = await f(tokenUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const token = (await tr.json()) as { access_token?: string };
      if (!tr.ok || !token.access_token) return err('Провайдер не подтвердил вход', 502);
      if (provider === 'google') {
        const pr = await f('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
        const p = (await pr.json()) as { sub?: string; name?: string; email?: string; email_verified?: boolean };
        if (!p.sub) return err('Провайдер не отдал профиль', 502);
        profile = { subject: p.sub, name: p.name ?? '', email: p.email_verified && p.email ? p.email : null };
      } else {
        const pr = await f('https://login.yandex.ru/info?format=json', { headers: { Authorization: `OAuth ${token.access_token}` } });
        const p = (await pr.json()) as { id?: string; display_name?: string; real_name?: string; default_email?: string };
        if (!p.id) return err('Провайдер не отдал профиль', 502);
        profile = { subject: p.id, name: p.real_name || p.display_name || '', email: p.default_email ?? null };
      }
    } catch {
      return err('Не удалось связаться с провайдером', 502);
    }
    return ok(this.signInExternal(provider, profile.subject, profile.name, profile.email, current));
  }

  /** Данные виджета Telegram подписаны ключом из токена бота. */
  signInTelegram(data: Record<string, unknown>, current: User | null): AuthResult<User> {
    const tg = this.opts.telegram;
    if (!tg) return err('Вход через Telegram не настроен', 503);
    const hash = typeof data.hash === 'string' ? data.hash : '';
    const check = Object.keys(data).filter((k) => k !== 'hash' && data[k] !== undefined && data[k] !== null)
      .sort().map((k) => `${k}=${String(data[k])}`).join('\n');
    const secret = createHash('sha256').update(tg.token).digest();
    const expected = createHmac('sha256', secret).update(check).digest('hex');
    if (!hash || !sameString(hash, expected)) return err('Подпись Telegram не сошлась', 401);
    const authDate = Number(data.auth_date);
    if (!authDate || Math.abs(this.now() / 1000 - authDate) > 86_400) return err('Данные Telegram устарели', 401);
    const id = String(data.id ?? '');
    if (!id) return err('Нет id пользователя Telegram');
    const name = [data.first_name, data.last_name].filter((x) => typeof x === 'string' && x).join(' ')
      || (typeof data.username === 'string' ? data.username : '');
    const label = typeof data.username === 'string' && data.username ? `@${data.username}` : name;
    return ok(this.signInExternal('telegram', id, name, null, current, label));
  }

  private signInExternal(provider: Provider, subject: string, name: string, email: string | null, current: User | null, label?: string): User {
    const existing = this.db.userIdByLogin(provider, subject);
    if (existing) return this.db.user(existing)!;
    const user = current ?? this.db.createUser(randomUUID(), cleanUserName(name) ?? 'Игрок', email);
    this.db.addLogin(user.id, provider, subject, label ?? email ?? name ?? null);
    // почта от провайдера тоже становится способом входа, если ещё не занята
    if (email) {
      const subj = this.db.emailSubject(email);
      if (!this.db.userIdByLogin('email', subj)) {
        this.db.addLogin(user.id, 'email', subj, email.toLowerCase());
        if (!user.email) this.db.setEmail(user.id, email.toLowerCase());
      }
    }
    return this.db.user(user.id)!;
  }

  private redirectUri(provider: string, origin: string): string {
    return `${this.opts.publicUrl ?? origin}/api/auth/oauth/${provider}/callback`;
  }
}

const DUMMY_HASH = hashPassword('kapital-dummy-password');

export function cleanUserName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return clean || null;
}
