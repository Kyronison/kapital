import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { RATING_POINTS, type AccountLogin, type PlayerStats, type Rating, type SaveSummary } from '@kapital/protocol';
import type { TableSnapshot } from './table.js';
import { Vault } from './vault.js';

/** Провайдеры входа. Почта ищется по подписи адреса, остальные — по id у провайдера. */
export type Provider = 'email' | 'google' | 'yandex' | 'telegram';

export interface User {
  id: string;
  name: string;
  /** Почта в открытом виде только после расшифровки, и только своему владельцу. */
  email: string | null;
  createdAt: number;
}

export type Login = AccountLogin;

/** Чем закончилась партия: levelId и stars — у уровня «Тренировки». */
export interface GameOutcome {
  levelId: string | null;
  stars: number | null;
  players: { id: string; bot: boolean; won: boolean }[];
}
export type { SaveSummary };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email_enc TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS logins (
  provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label_enc TEXT, PRIMARY KEY (provider, subject));
CREATE INDEX IF NOT EXISTS logins_user ON logins(user_id);
CREATE TABLE IF NOT EXISTS passwords (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS email_codes (
  subject TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS saves (
  id TEXT PRIMARY KEY, data_enc TEXT NOT NULL, mode TEXT NOT NULL, turn INTEGER NOT NULL, players TEXT NOT NULL,
  updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS save_players (
  save_id TEXT NOT NULL REFERENCES saves(id) ON DELETE CASCADE, user_id TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (save_id, user_id));
CREATE INDEX IF NOT EXISTS save_players_user ON save_players(user_id);
CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, level_id TEXT NOT NULL, stars INTEGER NOT NULL,
  PRIMARY KEY (user_id, level_id));
CREATE TABLE IF NOT EXISTS results (
  game_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, level_id TEXT,
  won INTEGER NOT NULL, humans INTEGER NOT NULL, finished_at INTEGER NOT NULL, PRIMARY KEY (game_id, user_id));
CREATE INDEX IF NOT EXISTS results_user ON results(user_id);
`;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// встроенный модуль берётся напрямую у Node: сборщик тестов (Vite) ещё не знает про node:sqlite
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = DatabaseSyncType;

/**
 * Единственная база сервера: аккаунты, сессии, сохранения партий и прогресс «Тренировки».
 * Личные данные (почта, имена входов, сами партии) лежат зашифрованными, пароли и токены — хэшами.
 */
export class Db {
  readonly sql: DatabaseSync;

  constructor(path: string, readonly vault: Vault, private readonly now: () => number = Date.now) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.sql = new DatabaseSync(path);
    this.sql.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.sql.exec(SCHEMA);
  }

  /** База в памяти для тестов. */
  static memory(now?: () => number): Db {
    return new Db(':memory:', new Vault(Buffer.alloc(32, 7)), now);
  }

  close() {
    this.sql.close();
  }

  // --- пользователи и способы входа ---

  createUser(id: string, name: string, email: string | null): User {
    const createdAt = this.now();
    this.sql.prepare('INSERT INTO users (id, name, email_enc, created_at) VALUES (?, ?, ?, ?)')
      .run(id, name, email ? this.vault.seal(email) : null, createdAt);
    return { id, name, email, createdAt };
  }

  user(id: string): User | null {
    const row = this.sql.prepare('SELECT id, name, email_enc, created_at FROM users WHERE id = ?').get(id) as
      { id: string; name: string; email_enc: string | null; created_at: number } | undefined;
    if (!row) return null;
    return { id: row.id, name: row.name, email: row.email_enc ? this.vault.open(row.email_enc) : null, createdAt: row.created_at };
  }

  rename(id: string, name: string) {
    this.sql.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  }

  setEmail(id: string, email: string) {
    this.sql.prepare('UPDATE users SET email_enc = ? WHERE id = ?').run(this.vault.seal(email), id);
  }

  /** Подпись почты для поиска: регистр и пробелы не важны. */
  emailSubject(email: string): string {
    return this.vault.sign(email.trim().toLowerCase());
  }

  userIdByLogin(provider: Provider, subject: string): string | null {
    const row = this.sql.prepare('SELECT user_id FROM logins WHERE provider = ? AND subject = ?').get(provider, subject) as
      { user_id: string } | undefined;
    return row?.user_id ?? null;
  }

  addLogin(userId: string, provider: Provider, subject: string, label: string | null) {
    this.sql.prepare('INSERT OR REPLACE INTO logins (provider, subject, user_id, label_enc) VALUES (?, ?, ?, ?)')
      .run(provider, subject, userId, label ? this.vault.seal(label) : null);
  }

  logins(userId: string): Login[] {
    const rows = this.sql.prepare('SELECT provider, label_enc FROM logins WHERE user_id = ? ORDER BY provider').all(userId) as
      { provider: Provider; label_enc: string | null }[];
    return rows.map((r) => ({ provider: r.provider, label: r.label_enc ? this.vault.open(r.label_enc) : null }));
  }

  passwordHash(userId: string): string | null {
    const row = this.sql.prepare('SELECT hash FROM passwords WHERE user_id = ?').get(userId) as { hash: string } | undefined;
    return row?.hash ?? null;
  }

  setPasswordHash(userId: string, hash: string) {
    this.sql.prepare('INSERT OR REPLACE INTO passwords (user_id, hash) VALUES (?, ?)').run(userId, hash);
  }

  // --- сессии: в базе только хэш токена ---

  createSession(userId: string, token: string, ttlMs: number) {
    const now = this.now();
    this.sql.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(sha256(token), userId, now, now + ttlMs);
  }

  sessionUser(token: string): User | null {
    const row = this.sql.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(sha256(token)) as
      { user_id: string; expires_at: number } | undefined;
    if (!row) return null;
    if (row.expires_at <= this.now()) {
      this.dropSession(token);
      return null;
    }
    return this.user(row.user_id);
  }

  dropSession(token: string) {
    this.sql.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  }

  dropSessions(userId: string) {
    this.sql.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  // --- одноразовые коды из письма ---

  putCode(subject: string, code: string, ttlMs: number) {
    this.sql.prepare('INSERT OR REPLACE INTO email_codes (subject, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)')
      .run(subject, sha256(`${subject}:${code}`), this.now() + ttlMs);
  }

  /** Проверяет код и сжигает его; после maxAttempts неверных попыток код пропадает. */
  takeCode(subject: string, code: string, maxAttempts: number): boolean {
    const row = this.sql.prepare('SELECT code_hash, expires_at, attempts FROM email_codes WHERE subject = ?').get(subject) as
      { code_hash: string; expires_at: number; attempts: number } | undefined;
    if (!row || row.expires_at <= this.now()) return false;
    if (row.code_hash === sha256(`${subject}:${code}`)) {
      this.sql.prepare('DELETE FROM email_codes WHERE subject = ?').run(subject);
      return true;
    }
    if (row.attempts + 1 >= maxAttempts) this.sql.prepare('DELETE FROM email_codes WHERE subject = ?').run(subject);
    else this.sql.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE subject = ?').run(subject);
    return false;
  }

  // --- сохранения партий ---

  saveTable(id: string, snap: TableSnapshot, owners: string[]) {
    const players = snap.seats.map((s) => s.name);
    const turn = Math.max(0, ...(snap.game?.players.map((p) => p.turnsTaken) ?? [0]));
    const upsert = this.sql.prepare(`INSERT INTO saves (id, data_enc, mode, turn, players, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data_enc = excluded.data_enc, mode = excluded.mode, turn = excluded.turn,
      players = excluded.players, updated_at = excluded.updated_at`);
    const link = this.sql.prepare('INSERT OR IGNORE INTO save_players (save_id, user_id) VALUES (?, ?)');
    this.sql.exec('BEGIN');
    try {
      upsert.run(id, this.vault.seal(JSON.stringify(snap)), snap.mode, turn, JSON.stringify(players), this.now());
      for (const u of owners) link.run(id, u);
      this.sql.exec('COMMIT');
    } catch (e) {
      this.sql.exec('ROLLBACK');
      throw e;
    }
  }

  loadTable(id: string): TableSnapshot | null {
    const row = this.sql.prepare('SELECT data_enc FROM saves WHERE id = ?').get(id) as { data_enc: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(this.vault.open(row.data_enc)) as TableSnapshot;
    } catch {
      return null;
    }
  }

  removeTable(id: string) {
    this.sql.prepare('DELETE FROM saves WHERE id = ?').run(id);
  }

  /** Незаконченные партии игрока, свежие первыми. */
  savesOf(userId: string): SaveSummary[] {
    const rows = this.sql.prepare(`SELECT s.id, s.mode, s.turn, s.players, s.updated_at FROM saves s
      JOIN save_players p ON p.save_id = s.id WHERE p.user_id = ? AND p.hidden = 0 ORDER BY s.updated_at DESC LIMIT 20`).all(userId) as
      { id: string; mode: string; turn: number; players: string; updated_at: number }[];
    return rows.map((r) => ({ saveId: r.id, mode: r.mode, turn: r.turn, players: JSON.parse(r.players) as string[], savedAt: r.updated_at }));
  }

  /** Игрок может убрать партию из своего списка; у остальных она остаётся. */
  hideSave(userId: string, saveId: string) {
    this.sql.prepare('UPDATE save_players SET hidden = 1 WHERE save_id = ? AND user_id = ?').run(saveId, userId);
  }

  // --- прогресс «Тренировки» ---

  progress(userId: string): Record<string, number> {
    const rows = this.sql.prepare('SELECT level_id, stars FROM progress WHERE user_id = ?').all(userId) as { level_id: string; stars: number }[];
    return Object.fromEntries(rows.map((r) => [r.level_id, r.stars]));
  }

  /** Хранится лучший результат. */
  setStars(userId: string, levelId: string, stars: number) {
    this.sql.prepare(`INSERT INTO progress (user_id, level_id, stars) VALUES (?, ?, ?)
      ON CONFLICT(user_id, level_id) DO UPDATE SET stars = MAX(stars, excluded.stars)`).run(userId, levelId, stars);
  }

  // --- итоги партий и рейтинг ---

  /**
   * Итог законченной партии для каждого человека за столом. Повторная запись той же партии ничего не меняет.
   * Звёзды уровня сервер ставит сам: в рейтинг идёт только то, что посчитано здесь.
   */
  recordGame(gameId: string, game: GameOutcome) {
    const insert = this.sql.prepare(`INSERT OR IGNORE INTO results (game_id, user_id, level_id, won, humans, finished_at)
      VALUES (?, ?, ?, ?, ?, ?)`);
    const humans = game.players.filter((p) => !p.bot);
    const finishedAt = this.now();
    this.sql.exec('BEGIN');
    try {
      for (const p of humans) {
        if (!this.user(p.id)) continue;
        insert.run(gameId, p.id, game.levelId, p.won ? 1 : 0, humans.length, finishedAt);
        if (game.levelId && game.stars && p.won) this.setStars(p.id, game.levelId, game.stars);
      }
      this.sql.exec('COMMIT');
    } catch (e) {
      this.sql.exec('ROLLBACK');
      throw e;
    }
  }

  /** Итоги всех игроков с местами; без очков места нет. */
  private standings(): PlayerStats[] {
    const p = RATING_POINTS;
    const rows = this.sql.prepare(`
      WITH lv AS (SELECT user_id, SUM(stars) stars FROM progress GROUP BY user_id),
      tb AS (SELECT user_id, COUNT(*) games, SUM(won) wins, SUM(CASE WHEN won = 1 AND humans > 1 THEN 1 ELSE 0 END) wins_people
        FROM results WHERE level_id IS NULL GROUP BY user_id),
      s AS (SELECT u.id, u.name, u.created_at, COALESCE(lv.stars, 0) stars, COALESCE(tb.games, 0) games, COALESCE(tb.wins, 0) wins,
        COALESCE(tb.wins_people, 0) wins_people FROM users u LEFT JOIN lv ON lv.user_id = u.id LEFT JOIN tb ON tb.user_id = u.id),
      pts AS (SELECT *, stars * ${p.star} + wins_people * ${p.winVsPeople} + (wins - wins_people) * ${p.winVsBots} + games * ${p.game} points FROM s)
      SELECT *, CASE WHEN points > 0 THEN RANK() OVER (ORDER BY points DESC) END place FROM pts
      ORDER BY points DESC, wins DESC, created_at`).all() as {
        id: string; name: string; stars: number; games: number; wins: number; wins_people: number; points: number; place: number | null;
      }[];
    return rows.map((r) => ({
      userId: r.id, name: r.name, points: r.points, place: r.place, games: r.games, wins: r.wins, winsVsPeople: r.wins_people, stars: r.stars,
    }));
  }

  /** Рейтинг: первые limit игроков с очками и строка самого игрока. */
  rating(userId: string, limit = 50): Rating {
    const all = this.standings();
    const ranked = all.filter((r) => r.place !== null);
    const me = all.find((r) => r.userId === userId) ?? { userId, name: '', points: 0, place: null, games: 0, wins: 0, winsVsPeople: 0, stars: 0 };
    return { top: ranked.slice(0, limit), me, players: ranked.length };
  }

  /** Просроченные сессии и коды. */
  sweep() {
    const now = this.now();
    this.sql.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    this.sql.prepare('DELETE FROM email_codes WHERE expires_at <= ?').run(now);
  }
}
