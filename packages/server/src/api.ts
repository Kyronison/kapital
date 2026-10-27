import type { IncomingMessage, ServerResponse } from 'node:http';
import { SESSION_TTL_MS, type Auth, type Me } from './auth.js';
import { isAvatar, type Rating } from '@kapital/protocol';
import type { SaveSummary, User } from './db.js';
import { randomToken } from './vault.js';

export const SESSION_COOKIE = 'kapital_session';
const OAUTH_COOKIE = 'kapital_oauth';
const BODY_LIMIT = 16 * 1024;
const SESSION_SECONDS = SESSION_TTL_MS / 1000;

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

/** Ответы HTTP-API: формы, которые читает клиент. */
export interface ApiShapes {
  providers: ReturnType<Auth['providers']>;
  me: Me;
  saves: SaveSummary[];
  progress: Record<string, number>;
  rating: Rating;
  ticket: { ticket: string };
}

/**
 * HTTP-API аккаунтов под /api. Всё остальное отдаёт сайт.
 * Сессия живёт в cookie HttpOnly; запросы с изменениями принимаются только со своего сайта (Origin).
 */
export function apiHandler(auth: Auth, fallback: Handler): Handler {
  return async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/')) return fallback(req, res);
    res.setHeader('Cache-Control', 'no-store');
    try {
      await route(auth, req, res, url);
    } catch (e) {
      console.error('Ошибка API', e);
      if (!res.headersSent) json(res, 500, { error: 'Ошибка сервера' });
    }
  };
}

async function route(auth: Auth, req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const path = url.pathname;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE] ?? null;
  const user = auth.userFromSession(token);
  const origin = siteOrigin(req);
  const secure = origin.startsWith('https:');
  const ip = clientIp(req);

  if (method !== 'GET' && method !== 'HEAD') {
    // браузер присылает Origin на все запросы с изменениями: чужой сайт cookie не воспользуется
    const from = req.headers.origin;
    if (from && from !== origin) return json(res, 403, { error: 'Запрос с чужого сайта' });
  }

  const login = (u: User, status = 200) => {
    const t = auth.startSession(u.id);
    setCookie(res, SESSION_COOKIE, t, secure, SESSION_SECONDS);
    json(res, status, auth.me(u));
  };
  const need = (): User | null => {
    if (!user) json(res, 401, { error: 'Нужно войти' });
    return user;
  };

  if (path === '/api/auth/providers' && method === 'GET') return json(res, 200, auth.providers());
  if (path === '/api/auth/me' && method === 'GET') return user ? json(res, 200, auth.me(user)) : json(res, 401, { error: 'Нужно войти' });
  if (path === '/api/auth/me' && method === 'PATCH') {
    const u = need();
    if (!u) return;
    const body = await readJson(req);
    if (typeof body.name === 'string') {
      const r = auth.rename(u.id, body.name);
      if (!r.ok) return fail(res, r);
    }
    if (typeof body.password === 'string') {
      const r = auth.setPassword(u.id, body.password);
      if (!r.ok) return fail(res, r);
    }
    if (body.avatar !== undefined) {
      if (!isAvatar(body.avatar)) return json(res, 400, { error: 'Такого аватара нет' });
      auth.db.setAvatar(u.id, body.avatar);
    }
    return json(res, 200, auth.me(auth.db.user(u.id)!));
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    if (token) auth.endSession(token);
    setCookie(res, SESSION_COOKIE, '', secure, 0);
    return json(res, 200, { ok: true });
  }
  if (path === '/api/auth/ticket' && method === 'POST') {
    const u = need();
    if (!u) return;
    return json(res, 200, { ticket: auth.ticket(u.id) } satisfies ApiShapes['ticket']);
  }
  if (path === '/api/auth/email/code' && method === 'POST') {
    const body = await readJson(req);
    const r = await auth.sendCode(String(body.email ?? ''), ip);
    return r.ok ? json(res, 200, { ok: true }) : fail(res, r);
  }
  if (path === '/api/auth/email/verify' && method === 'POST') {
    const body = await readJson(req);
    const r = auth.verifyCode(String(body.email ?? ''), String(body.code ?? ''), optString(body.name), optString(body.password), user);
    if (!r.ok) return fail(res, r);
    if ('needName' in r.value) return json(res, 200, { needName: true });
    return login(r.value.user);
  }
  if (path === '/api/auth/email/password' && method === 'POST') {
    const body = await readJson(req);
    const r = auth.signInWithPassword(String(body.email ?? ''), String(body.password ?? ''), ip);
    return r.ok ? login(r.value) : fail(res, r);
  }
  if (path === '/api/auth/telegram' && method === 'POST') {
    const body = await readJson(req);
    const r = auth.signInTelegram(body, user);
    return r.ok ? login(r.value) : fail(res, r);
  }
  const oauth = /^\/api\/auth\/oauth\/(google|yandex)\/(start|callback)$/.exec(path);
  if (oauth && method === 'GET') {
    const provider = oauth[1] as 'google' | 'yandex';
    if (oauth[2] === 'start') {
      const state = randomToken(16);
      const r = auth.oauthStart(provider, origin, state);
      if (!r.ok) return fail(res, r);
      setCookie(res, OAUTH_COOKIE, state, secure, 600);
      res.writeHead(302, { Location: r.value }).end();
      return;
    }
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!code || !state || state !== cookies[OAUTH_COOKIE]) return page(res, 400, 'Вход не удался: попробуйте ещё раз с начала');
    setCookie(res, OAUTH_COOKIE, '', secure, 0);
    const r = await auth.oauthFinish(provider, origin, code, user);
    if (!r.ok) return page(res, r.status ?? 400, r.error);
    const t = auth.startSession(r.value.id);
    setCookie(res, SESSION_COOKIE, t, secure, SESSION_SECONDS);
    res.writeHead(302, { Location: '/' }).end();
    return;
  }
  if (path === '/api/saves' && method === 'GET') {
    const u = need();
    if (!u) return;
    return json(res, 200, auth.db.savesOf(u.id) satisfies ApiShapes['saves']);
  }
  const save = /^\/api\/saves\/([A-Za-z0-9_-]{1,64})$/.exec(path);
  if (save && method === 'DELETE') {
    const u = need();
    if (!u) return;
    auth.db.hideSave(u.id, save[1]!);
    return json(res, 200, { ok: true });
  }
  if (path === '/api/progress' && method === 'GET') {
    const u = need();
    if (!u) return;
    return json(res, 200, auth.db.progress(u.id) satisfies ApiShapes['progress']);
  }
  if (path === '/api/rating' && method === 'GET') {
    const u = need();
    if (!u) return;
    return json(res, 200, auth.db.rating(u.id) satisfies ApiShapes['rating']);
  }
  if (path === '/api/health' && method === 'GET') return json(res, 200, { ok: true });
  json(res, 404, { error: 'Нет такого адреса' });
}

function fail(res: ServerResponse, r: { ok: false; error: string; status?: number }) {
  json(res, r.status ?? 400, { error: r.error });
}

function json(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

function page(res: ServerResponse, status: number, text: string) {
  const html = `<!doctype html><meta charset="utf-8"><title>Капитал</title><p>${escape(text)}</p><p><a href="/">На главную</a></p>`;
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function optString(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > BODY_LIMIT) throw new Error('Слишком большой запрос');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res: ServerResponse, name: string, value: string, secure: boolean, maxAge: number) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), parts.join('; ')]);
}

/** Адрес сайта, как его видит браузер: за обратным прокси берётся из его заголовков. */
export function siteOrigin(req: IncomingMessage): string {
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0]!.trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost').split(',')[0]!.trim();
  return `${proto}://${host}`;
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || '?';
}
