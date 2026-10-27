import type { Server } from '@colyseus/core';
import { Client } from 'colyseus.js';
import { createHash, createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Auth, createServer, Db, ROOM_NAME, type Account, type SaveSummary } from '../src/index.js';
import { AVATARS, type Rating } from '@kapital/protocol';
import { Vault, checkPassword, hashPassword } from '../src/vault.js';

const PORT = 3600 + Math.floor(Math.random() * 1000);
const BOT_TOKEN = '123456:test-bot-token';
let now = 1_000_000;
const db = Db.memory(() => now);
const letters: { to: string; text: string }[] = [];
const auth = new Auth(db, {
  mailer: { send: async (to, _subject, text) => { letters.push({ to, text }); } },
  telegram: { token: BOT_TOKEN, botName: 'kapital_bot' },
}, () => now);
let server: Server;
const base = () => `http://localhost:${PORT}`;

/** Браузер одного игрока: хранит cookie между запросами и шлёт Origin, как настоящий. */
function browser() {
  let cookie = '';
  return async (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    const r = await fetch(`${base()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: base(), Cookie: cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    for (const c of r.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [name, value] = pair!.split('=');
      const rest = cookie.split('; ').filter((x) => x && !x.startsWith(`${name}=`));
      if (value) rest.push(`${name}=${value}`);
      cookie = rest.join('; ');
    }
    const text = await r.text();
    return { status: r.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown>, cookie };
  };
}

const lastCode = () => /\d{6}/.exec(letters.at(-1)!.text)![0];

beforeAll(async () => {
  server = createServer(auth, { botDelayMs: 0 });
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

describe('шифрование и пароли', () => {
  it('хранилище шифрует, а чужой ключ не расшифрует', () => {
    const a = new Vault(Buffer.alloc(32, 1));
    const b = new Vault(Buffer.alloc(32, 2));
    const sealed = a.seal('тайна');
    expect(sealed).not.toContain('тайна');
    expect(a.open(sealed)).toBe('тайна');
    expect(() => b.open(sealed)).toThrow();
    expect(a.sign('x')).not.toBe(b.sign('x'));
  });

  it('пароль хранится хэшем и проверяется', () => {
    const h = hashPassword('correct horse');
    expect(h).not.toContain('correct');
    expect(checkPassword('correct horse', h)).toBe(true);
    expect(checkPassword('wrong', h)).toBe(false);
  });

  it('почта и партия в базе лежат зашифрованными', () => {
    const u = db.createUser('enc-1', 'Шифр', 'secret@example.com');
    const row = db.sql.prepare('SELECT email_enc FROM users WHERE id = ?').get(u.id) as { email_enc: string };
    expect(row.email_enc).not.toContain('secret');
    expect(db.user(u.id)!.email).toBe('secret@example.com');
  });
});

describe('вход по почте', () => {
  it('код из письма: новому игроку нужно имя, потом cookie сессии и профиль', async () => {
    const me = browser();
    expect((await me('/api/auth/me')).status).toBe(401);
    expect((await me('/api/auth/email/code', 'POST', { email: 'не почта' })).status).toBe(400);
    expect((await me('/api/auth/email/code', 'POST', { email: ' Anya@Example.com ' })).status).toBe(200);
    expect(letters.at(-1)!.to).toBe('anya@example.com');
    const code = lastCode();
    expect((await me('/api/auth/email/verify', 'POST', { email: 'anya@example.com', code: '000000' })).status).toBe(400);
    const first = await me('/api/auth/email/verify', 'POST', { email: 'anya@example.com', code });
    expect(first.body).toEqual({ needName: true });
    const second = await me('/api/auth/email/verify', 'POST', { email: 'anya@example.com', code, name: '  Аня  ', password: 'длинный пароль' });
    expect(second.status).toBe(200);
    expect(second.cookie).toContain('kapital_session=');
    const account = (await me('/api/auth/me')).body as unknown as Account;
    expect(account.user.name).toBe('Аня');
    expect(account.user.email).toBe('anya@example.com');
    expect(account.logins).toEqual([{ provider: 'email', label: 'anya@example.com' }]);
    expect(account.hasPassword).toBe(true);
    // код одноразовый
    expect((await browser()('/api/auth/email/verify', 'POST', { email: 'anya@example.com', code })).status).toBe(400);
  });

  it('вход по паролю с другого устройства и выход', async () => {
    const other = browser();
    expect((await other('/api/auth/email/password', 'POST', { email: 'anya@example.com', password: 'не тот' })).status).toBe(401);
    expect((await other('/api/auth/email/password', 'POST', { email: 'nobody@example.com', password: 'длинный пароль' })).status).toBe(401);
    const r = await other('/api/auth/email/password', 'POST', { email: 'ANYA@example.com', password: 'длинный пароль' });
    expect(r.status).toBe(200);
    expect((r.body as unknown as Account).user.name).toBe('Аня');
    expect((await other('/api/auth/logout', 'POST')).status).toBe(200);
    expect((await other('/api/auth/me')).status).toBe(401);
  });

  it('пять неверных попыток сжигают код, а письма ограничены', async () => {
    const me = browser();
    await me('/api/auth/email/code', 'POST', { email: 'spam@example.com' });
    const code = lastCode();
    for (let i = 0; i < 5; i++) await me('/api/auth/email/verify', 'POST', { email: 'spam@example.com', code: '111111' });
    expect((await me('/api/auth/email/verify', 'POST', { email: 'spam@example.com', code, name: 'Спам' })).status).toBe(400);
    await me('/api/auth/email/code', 'POST', { email: 'spam@example.com' });
    await me('/api/auth/email/code', 'POST', { email: 'spam@example.com' });
    expect((await me('/api/auth/email/code', 'POST', { email: 'spam@example.com' })).status).toBe(429);
    now += 11 * 60_000;
    expect((await me('/api/auth/email/code', 'POST', { email: 'spam@example.com' })).status).toBe(200);
  });

  it('запрос с чужого сайта отвергается', async () => {
    const me = browser();
    const r = await me('/api/auth/email/code', 'POST', { email: 'x@example.com' }, { Origin: 'https://evil.example' });
    expect(r.status).toBe(403);
  });
});

describe('Telegram', () => {
  const signed = (data: Record<string, string | number>) => {
    const check = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('\n');
    const secret = createHash('sha256').update(BOT_TOKEN).digest();
    return { ...data, hash: createHmac('sha256', secret).update(check).digest('hex') };
  };

  it('подпись виджета проверяется, аккаунт создаётся один раз', async () => {
    const me = browser();
    const data = { id: 42, first_name: 'Боря', username: 'borya', auth_date: Math.floor(now / 1000) };
    expect((await me('/api/auth/telegram', 'POST', { ...signed(data), first_name: 'Хакер' })).status).toBe(401);
    const r = await me('/api/auth/telegram', 'POST', signed(data));
    expect(r.status).toBe(200);
    const account = r.body as unknown as Account;
    expect(account.user.name).toBe('Боря');
    expect(account.logins).toEqual([{ provider: 'telegram', label: '@borya' }]);
    const again = await browser()('/api/auth/telegram', 'POST', signed({ ...data, first_name: 'Борис' }));
    expect((again.body as unknown as Account).user.id).toBe(account.user.id);
    expect((await me('/api/auth/telegram', 'POST', signed({ ...data, auth_date: data.auth_date - 200_000 }))).status).toBe(401);
  });

  it('вошедший игрок привязывает второй способ входа к тому же аккаунту', async () => {
    const me = browser();
    await me('/api/auth/telegram', 'POST', signed({ id: 43, first_name: 'Вера', auth_date: Math.floor(now / 1000) }));
    await me('/api/auth/email/code', 'POST', { email: 'vera@example.com' });
    const r = await me('/api/auth/email/verify', 'POST', { email: 'vera@example.com', code: lastCode() });
    const account = r.body as unknown as Account;
    expect(account.logins.map((l) => l.provider)).toEqual(['email', 'telegram']);
    expect(account.user.email).toBe('vera@example.com');
  });
});

describe('профиль, партии и прогресс', () => {
  it('имя и пароль меняются, прогресс хранит лучший результат', async () => {
    const me = browser();
    await me('/api/auth/email/code', 'POST', { email: 'gena@example.com' });
    await me('/api/auth/email/verify', 'POST', { email: 'gena@example.com', code: lastCode(), name: 'Гена' });
    expect((await me('/api/auth/me', 'PATCH', { password: 'коротк' })).status).toBe(400);
    const r = await me('/api/auth/me', 'PATCH', { name: 'Геннадий', password: 'новый пароль 1' });
    expect((r.body as unknown as Account).user.name).toBe('Геннадий');
    expect((await browser()('/api/auth/email/password', 'POST', { email: 'gena@example.com', password: 'новый пароль 1' })).status).toBe(200);
    // звёзды ставит только сервер по итогу уровня: прислать их самому нельзя
    expect((await me('/api/progress', 'PUT', { 'novice-1': 3 })).status).toBe(404);
    const id = (r.body as unknown as Account).user.id;
    db.recordGame('lv-1', { levelId: 'novice-1', stars: 2, players: [{ id, bot: false, won: true }] });
    db.recordGame('lv-2', { levelId: 'novice-1', stars: 1, players: [{ id, bot: false, won: true }] });
    expect((await me('/api/progress')).body).toEqual({ 'novice-1': 2 });
    const rating = (await me('/api/rating')).body as unknown as Rating;
    expect(rating.training.me).toMatchObject({ name: 'Геннадий', value: 2, place: 1 });
    // аватар: сначала постоянный по id, потом выбранный; чужие значения не принимаются
    expect(AVATARS).toContain((r.body as unknown as Account).user.avatar);
    expect((await me('/api/auth/me', 'PATCH', { avatar: '../../etc/passwd' })).status).toBe(400);
    expect(((await me('/api/auth/me', 'PATCH', { avatar: 'owl' })).body as unknown as Account).user.avatar).toBe('owl');
    expect(((await me('/api/rating')).body as unknown as Rating).training.me.avatar).toBe('owl');
    expect(rating.stats).toEqual({ games: 0, wins: 0, stars: 2, levels: 1 });
  });

  it('по билету игрок входит в комнату, а партия появляется в его списке', async () => {
    const me = browser();
    await me('/api/auth/email/code', 'POST', { email: 'dima@example.com' });
    await me('/api/auth/email/verify', 'POST', { email: 'dima@example.com', code: lastCode(), name: 'Дима' });
    const ticket = (await me('/api/auth/ticket', 'POST')).body.ticket as string;
    const client = new Client(`ws://localhost:${PORT}`);
    client.auth.token = ticket;
    const room = await client.create(ROOM_NAME);
    room.onMessage('*', () => {});
    room.send('add_bot');
    room.send('start');
    await new Promise((r) => setTimeout(r, 300));
    await room.leave();
    await new Promise((r) => setTimeout(r, 200));
    const saves = (await me('/api/saves')).body as unknown as SaveSummary[];
    expect(saves.map((s) => s.players)).toEqual([['Дима', 'Бот 1']]);
    expect((await me(`/api/saves/${saves[0]!.saveId}`, 'DELETE')).status).toBe(200);
    expect((await me('/api/saves')).body).toEqual([]);
    // билет одноразовый
    client.auth.token = ticket;
    await expect(client.create(ROOM_NAME)).rejects.toThrow();
  });
});

describe('рейтинг', () => {
  const win = (d: Db, game: string, winner: string, others: string[]) =>
    d.recordGame(game, { levelId: null, stars: null, players: [winner, ...others].map((id) => ({ id, bot: false, won: id === winner })) });

  it('очко партий — уникальный побеждённый соперник за месяц, место после 5 зачётных партий', () => {
    let now = Date.UTC(2026, 9, 10);
    const d = Db.memory(() => now);
    for (const [id, name] of [['a', 'Аня'], ['b', 'Боря'], ['c', 'Вика'], ['g', 'Гоша']] as const) d.createUser(id, name, null);
    win(d, 'g1', 'a', ['b', 'c']);
    win(d, 'g1', 'a', ['b', 'c']); // повтор итога той же партии
    win(d, 'g2', 'a', ['b', 'c']); // те же соперники: очков не прибавляет
    win(d, 'g3', 'a', ['b', 'g']); // +1 за Гошу
    // на двоих партия не зачётная
    d.recordGame('duo', { levelId: null, stars: null, players: [{ id: 'a', bot: false, won: true }, { id: 'x', bot: false, won: false }] });
    expect(d.rating('a').games).toMatchObject({ counted: 3, players: 0, me: { value: 3, place: null } });
    win(d, 'g4', 'b', ['a', 'c']);
    win(d, 'g5', 'c', ['a', 'b']);
    const r = d.rating('a');
    expect(r.games.me).toMatchObject({ value: 3, place: 1 });
    expect(r.games.counted).toBe(5);
    expect(r.stats).toMatchObject({ games: 6, wins: 4 }); // в статистике и партия на двоих
    // новый месяц по Москве: счёт с нуля
    now = Date.UTC(2026, 9, 31, 21, 30);
    expect(d.rating('a').games.me.value).toBe(0);
  });

  it('в тренировке равные звёзды делят место', () => {
    const d = Db.memory();
    for (const id of ['a', 'b', 'c']) d.createUser(id, id, null);
    d.setStars('a', 'novice-1', 3);
    d.setStars('b', 'novice-1', 3);
    d.setStars('c', 'novice-1', 1);
    expect(d.rating('c').training.top.map((r) => [r.userId, r.place])).toEqual([['a', 1], ['b', 1], ['c', 3]]);
  });
});
