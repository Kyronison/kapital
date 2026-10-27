import type { Server } from '@colyseus/core';
import { Client } from 'colyseus.js';
import { createHash, createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Auth, createServer, Db, ROOM_NAME, type Account, type SaveSummary } from '../src/index.js';
import type { Rating } from '@kapital/protocol';
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
    expect(rating.me).toMatchObject({ name: 'Геннадий', stars: 2, points: 20 });
    expect(rating.top.some((x) => x.userId === id)).toBe(true);
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
  it('победа над людьми весит больше победы над ботами, повтор итога не считается', () => {
    const d = Db.memory();
    d.createUser('a', 'Аня', null);
    d.createUser('b', 'Боря', null);
    d.createUser('c', 'Вика', null);
    d.recordGame('g1', { levelId: null, stars: null, players: [{ id: 'a', bot: false, won: true }, { id: 'b', bot: false, won: false }] });
    d.recordGame('g1', { levelId: null, stars: null, players: [{ id: 'a', bot: false, won: true }, { id: 'b', bot: false, won: false }] });
    d.recordGame('g2', { levelId: null, stars: null, players: [{ id: 'b', bot: false, won: true }, { id: 'bot-1', bot: true, won: false }] });
    const r = d.rating('c');
    expect(r.top.map((x) => [x.name, x.points, x.place])).toEqual([['Аня', 55, 1], ['Боря', 25, 2]]);
    expect(r.me).toMatchObject({ name: 'Вика', points: 0, place: null });
    expect(r.players).toBe(2);
    expect(d.rating('b').me).toMatchObject({ games: 2, wins: 1, winsVsPeople: 0 });
  });
});
