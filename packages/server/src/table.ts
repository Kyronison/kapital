import { randomUUID } from 'node:crypto';
import { contentFor, contentForLevel, levels, type Content, type GameMode, type Level } from '@kapital/content';
import {
  applyAction, botAction, createGame, levelProgress, levelStars, MAX_PLAYERS, type Action, type GameEvent, type GameState,
} from '@kapital/engine';

export interface Seat {
  id: string;
  name: string;
  professionId: string | null;
  dreamId: string | null;
  bot: boolean;
  connected: boolean;
}

/** Что видят клиенты: без порядка колод и состояния ГПСЧ, иначе можно предсказать карты и кубики. */
export type PublicGame = Omit<GameState, 'decks' | 'rng' | 'seed'>;

export interface ChatMessage {
  n: number;
  seatId: string;
  name: string;
  text: string;
  at: number;
}

/** Итог уровня «Тренировки»: null, пока партия идёт. */
export interface LevelView {
  id: string;
  /** Насколько цель выполнена, от 0 до 1. */
  share: number;
  result: { passed: true; stars: 1 | 2 | 3; turns: number } | { passed: false } | null;
}

export interface TableView {
  hostId: string | null;
  mode: GameMode;
  level: LevelView | null;
  seats: Seat[];
  game: PublicGame | null;
  chat: ChatMessage[];
}

/** Место за столом, которое получил клиент: по ключу он вернётся на него после перерыва. */
export interface SeatTicket {
  seatId: string;
  key: string;
}

/** Всё, что нужно, чтобы продолжить партию после перезапуска сервера. */
export interface TableSnapshot {
  v: 1;
  seats: Seat[];
  hostId: string | null;
  mode: GameMode;
  levelId?: string | null;
  game: GameState | null;
  chat: ChatMessage[];
  botCount: number;
  keys: [string, string][];
}

export const CHAT_LIMIT = 50;
const CHAT_TEXT_MAX = 200;
/** Не больше стольких сообщений за окно, чтобы чат нельзя было залить. */
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 10_000;

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = (error: string): Result<never> => ({ ok: false, error });

/**
 * Стол одной партии: лобби, места, запуск и проверка действий через движок.
 * Не знает про сеть и таймеры: этим занимается комната Colyseus.
 */
export class Table {
  seats: Seat[] = [];
  hostId: string | null = null;
  game: GameState | null = null;
  // по умолчанию короткая партия: полную выбирают осознанно
  mode: GameMode = 'quick';
  /** Уровень «Тренировки»: одиночная партия со своей целью и сроком. */
  level: Level | null = null;
  chat: ChatMessage[] = [];
  private botCount = 0;
  private chatCount = 0;
  /** Соединение → место. Место получает id первого соединения и сохраняет его навсегда. */
  private sessions = new Map<string, string>();
  /** Место → секретный ключ возврата. В view не попадает. */
  private keys = new Map<string, string>();
  private recentChat = new Map<string, number[]>();

  constructor(
    private readonly base: Content,
    private readonly random: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  static restore(base: Content, snap: TableSnapshot, random?: () => number, now?: () => number): Table {
    if (snap.v !== 1) throw new Error('Неизвестная версия сохранения');
    const t = new Table(base, random, now);
    t.seats = snap.seats.map((s) => ({ ...s, connected: s.bot }));
    t.hostId = snap.hostId;
    t.mode = snap.mode;
    t.level = levels.find((l) => l.id === snap.levelId) ?? null;
    t.game = snap.game;
    t.chat = snap.chat;
    t.chatCount = snap.chat.at(-1)?.n ?? 0;
    t.botCount = snap.botCount;
    t.keys = new Map(snap.keys);
    return t;
  }

  snapshot(): TableSnapshot {
    return {
      v: 1, seats: this.seats, hostId: this.hostId, mode: this.mode, levelId: this.level?.id ?? null, game: this.game, chat: this.chat,
      botCount: this.botCount, keys: [...this.keys],
    };
  }

  keyOf(seatId: string): string | undefined {
    return this.keys.get(seatId);
  }

  /** Место, за которым сидит соединение. */
  seatOf(session: string): string {
    return this.sessions.get(session) ?? session;
  }

  /** Правила зависят от режима, который создатель выбирает в лобби. */
  get content(): Content {
    return this.level ? contentForLevel(this.level, this.base) : contentFor(this.mode, this.base);
  }

  /** Стол уровня «Тренировки». Выбирается при создании, до входа игроков. */
  setLevel(levelId: unknown): Result {
    const level = levels.find((l) => l.id === levelId);
    if (!level) return err('Неизвестный уровень');
    if (this.seats.length > 0) return err('Уровень выбирают до входа игроков');
    this.level = level;
    this.mode = level.mode;
    return ok(undefined);
  }

  setMode(session: string, mode: unknown): Result {
    if (this.seatOf(session) !== this.hostId) return err('Режим выбирает создатель стола');
    if (this.level) return err('У уровня свой режим');
    if (this.started) return err('Партия уже началась');
    if (mode !== 'classic' && mode !== 'quick') return err('Неизвестный режим');
    this.mode = mode;
    return ok(undefined);
  }

  get started(): boolean {
    return this.game !== null;
  }

  join(session: string, name: string, professionId?: string, dreamId?: string, key?: string): Result<SeatTicket> {
    if (key) {
      const seatId = [...this.keys].find(([, k]) => k === key)?.[0];
      const seat = this.seats.find((s) => s.id === seatId);
      if (!seat) return err('Место в этой партии не найдено');
      this.sessions.set(session, seat.id);
      seat.connected = true;
      this.hostId ??= seat.id;
      return ok({ seatId: seat.id, key });
    }
    const id = this.seatOf(session);
    if (this.started) {
      const seat = this.seats.find((s) => s.id === id);
      if (!seat) return err('Партия уже началась');
      seat.connected = true;
      return ok({ seatId: id, key: this.keys.get(id)! });
    }
    if (this.seats.length >= MAX_PLAYERS) return err('Все места заняты');
    if (this.level && this.seats.length > 0) return err('Уровень проходят в одиночку');
    if (this.level) {
      professionId = this.level.professionId;
      dreamId = this.level.dreamId;
    }
    if (professionId && !this.content.professions.some((p) => p.id === professionId)) {
      return err('Неизвестная профессия');
    }
    if (dreamId && !this.content.dreams.some((d) => d.id === dreamId)) return err('Неизвестная мечта');
    const cleanName = name.trim().slice(0, 24) || `Игрок ${this.seats.length + 1}`;
    this.seats.push({ id, name: cleanName, professionId: professionId ?? null, dreamId: dreamId ?? null, bot: false, connected: true });
    this.hostId ??= id;
    const ticket = { seatId: id, key: randomUUID() };
    this.keys.set(id, ticket.key);
    return ok(ticket);
  }

  addBot(session: string): Result {
    if (this.seatOf(session) !== this.hostId) return err('Добавлять ботов может только создатель стола');
    if (this.level) return err('Уровень проходят в одиночку');
    if (this.started) return err('Партия уже началась');
    if (this.seats.length >= MAX_PLAYERS) return err('Все места заняты');
    this.botCount++;
    this.seats.push({ id: `bot-${this.botCount}`, name: `Бот ${this.botCount}`, professionId: null, dreamId: null, bot: true, connected: true });
    return ok(undefined);
  }

  /** Игрок ушёл: в лобби освобождает место, в партии за него ходит бот, пока он не вернётся. */
  leave(session: string): void {
    const id = this.seatOf(session);
    this.sessions.delete(session);
    if (!this.started) {
      this.seats = this.seats.filter((s) => s.id !== id);
      this.keys.delete(id);
      if (this.hostId === id) this.hostId = this.seats.find((s) => !s.bot)?.id ?? null;
      return;
    }
    const seat = this.seats.find((s) => s.id === id);
    if (seat) seat.connected = false;
    // создатель ушёл посреди партии: старшим становится следующий, кто на связи
    if (this.hostId === id) this.hostId = this.seats.find((s) => !s.bot && s.connected)?.id ?? this.hostId;
  }

  /** Сообщение в чат стола. Видят все за столом. */
  say(session: string, text: unknown): Result {
    const seat = this.seats.find((s) => s.id === this.seatOf(session));
    if (!seat) return err('Вы не за этим столом');
    if (typeof text !== 'string') return err('Пустое сообщение');
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, CHAT_TEXT_MAX);
    if (!clean) return err('Пустое сообщение');
    const now = this.now();
    const recent = (this.recentChat.get(seat.id) ?? []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_BURST) return err('Слишком часто: подождите несколько секунд');
    this.recentChat.set(seat.id, [...recent, now]);
    this.chat = [...this.chat, { n: ++this.chatCount, seatId: seat.id, name: seat.name, text: clean, at: now }].slice(-CHAT_LIMIT);
    return ok(undefined);
  }

  /** Все люди отключились: боты ждут, партия не уходит вперёд без игроков. */
  get paused(): boolean {
    return this.started && this.seats.some((s) => !s.bot) && this.humansConnected === 0;
  }

  get humansConnected(): number {
    return this.seats.filter((s) => !s.bot && s.connected).length;
  }

  start(session: string): Result {
    if (this.seatOf(session) !== this.hostId) return err('Начать партию может только создатель стола');
    if (this.started) return err('Партия уже началась');
    const pick = <T>(items: T[]): T => items[Math.floor(this.random() * items.length)]!;
    for (const seat of this.seats) {
      seat.professionId ??= pick(this.content.professions).id;
      seat.dreamId ??= pick(this.content.dreams).id;
    }
    const seed = Math.floor(this.random() * 2 ** 32);
    this.game = createGame(
      this.content,
      this.seats.map((s) => ({ id: s.id, name: s.name, professionId: s.professionId!, dreamId: s.dreamId! })),
      seed,
    );
    return ok(undefined);
  }

  /** Действие игрока. playerId всегда берётся из соединения, а не из сообщения клиента. */
  act(session: string, action: Record<string, unknown>): Result<GameEvent[]> {
    if (!this.game) return err('Партия ещё не началась');
    if (typeof action.type !== 'string') return err('Неверное действие');
    return this.apply({ ...action, playerId: this.seatOf(session) } as Action);
  }

  private apply(action: Action): Result<GameEvent[]> {
    const r = applyAction(this.content, this.game!, action);
    if (!r.ok) return err(r.error);
    this.game = r.state;
    return ok([...r.events, ...this.checkLevel()]);
  }

  /** Цель уровня выполнена: партия заканчивается победой, даже если до мечты далеко. */
  private checkLevel(): GameEvent[] {
    const game = this.game!;
    if (!this.level || game.status !== 'playing') return [];
    const p = game.players[0]!;
    if (!levelProgress(this.content, this.level, game, p).done) return [];
    this.game = { ...game, status: 'finished', winnerId: p.id };
    return [{ type: 'game_finished' }];
  }

  private autopilot(seat: Seat): boolean {
    return seat.bot || !seat.connected;
  }

  /**
   * Один ход бота: за ботов и за отключившихся игроков. Сначала текущий игрок, затем ответные
   * продажи остальных. Возвращает null, если ботам делать нечего.
   */
  botStep(): GameEvent[] | null {
    const game = this.game;
    if (!game || game.status !== 'playing' || this.paused) return null;
    const currentId = game.players[game.current]!.id;
    const order = [currentId, ...this.seats.map((s) => s.id).filter((id) => id !== currentId)];
    for (const id of order) {
      const seat = this.seats.find((s) => s.id === id);
      if (!seat || !this.autopilot(seat)) continue;
      // текущий бот ходит, только если ответные продажи уже сделаны
      if (id === currentId && this.pendingReactions(currentId)) continue;
      const action = botAction(this.content, game, id);
      if (!action) continue;
      const r = this.apply(action);
      // бот не должен ошибаться; если ошибся, завершаем за него ход, чтобы партия не встала
      if (!r.ok) return id === currentId ? this.forceEndTurn() : null;
      return r.value;
    }
    return null;
  }

  private pendingReactions(currentId: string): boolean {
    const game = this.game!;
    return this.seats.some((s) => s.id !== currentId && this.autopilot(s) && botAction(this.content, game, s.id) !== null);
  }

  /** Время хода вышло: доигрываем ход за текущего игрока. */
  timeout(): GameEvent[] {
    const game = this.game;
    if (!game || game.status !== 'playing') return [];
    const currentId = game.players[game.current]!.id;
    const events: GameEvent[] = [];
    for (let i = 0; i < 50 && this.game!.status === 'playing' && this.game!.players[this.game!.current]!.id === currentId; i++) {
      const action = botAction(this.content, this.game!, currentId);
      const r = action ? this.apply(action) : err('нет действия');
      if (!r.ok) {
        events.push(...(this.forceEndTurn() ?? []));
        break;
      }
      events.push(...r.value);
    }
    return events;
  }

  private forceEndTurn(): GameEvent[] | null {
    const game = this.game!;
    const id = game.players[game.current]!.id;
    if (game.phase === 'roll') {
      const rolled = this.apply({ type: 'ROLL', playerId: id });
      if (!rolled.ok) return null;
    }
    const r = this.apply({ type: 'END_TURN', playerId: id });
    return r.ok ? r.value : null;
  }

  view(): TableView {
    let game: PublicGame | null = null;
    if (this.game) {
      const { decks: _decks, rng: _rng, seed: _seed, ...rest } = this.game;
      game = rest;
    }
    return { hostId: this.hostId, mode: this.mode, level: this.levelView(), seats: this.seats, game, chat: this.chat };
  }

  private levelView(): LevelView | null {
    const level = this.level;
    if (!level) return null;
    const game = this.game;
    const p = game?.players[0];
    if (!game || !p) return { id: level.id, share: 0, result: null };
    const progress = levelProgress(this.content, level, game, p);
    const result = game.status === 'playing' ? null
      : progress.done ? { passed: true as const, stars: levelStars(level, p.turnsTaken), turns: p.turnsTaken }
      : { passed: false as const };
    return { id: level.id, share: progress.share, result };
  }
}
