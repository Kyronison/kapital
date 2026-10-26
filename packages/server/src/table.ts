import { contentFor, type Content, type GameMode } from '@kapital/content';
import {
  applyAction, botAction, createGame, MAX_PLAYERS, type Action, type GameEvent, type GameState,
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

export interface TableView {
  hostId: string | null;
  mode: GameMode;
  seats: Seat[];
  game: PublicGame | null;
}

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
  private botCount = 0;

  constructor(
    private readonly base: Content,
    private readonly random: () => number = Math.random,
  ) {}

  /** Правила зависят от режима, который создатель выбирает в лобби. */
  get content(): Content {
    return contentFor(this.mode, this.base);
  }

  setMode(byId: string, mode: unknown): Result {
    if (byId !== this.hostId) return err('Режим выбирает создатель стола');
    if (this.started) return err('Партия уже началась');
    if (mode !== 'classic' && mode !== 'quick') return err('Неизвестный режим');
    this.mode = mode;
    return ok(undefined);
  }

  get started(): boolean {
    return this.game !== null;
  }

  join(id: string, name: string, professionId?: string, dreamId?: string): Result {
    if (this.started) {
      const seat = this.seats.find((s) => s.id === id);
      if (!seat) return err('Партия уже началась');
      seat.connected = true;
      return ok(undefined);
    }
    if (this.seats.length >= MAX_PLAYERS) return err('Все места заняты');
    if (professionId && !this.content.professions.some((p) => p.id === professionId)) {
      return err('Неизвестная профессия');
    }
    if (dreamId && !this.content.dreams.some((d) => d.id === dreamId)) return err('Неизвестная мечта');
    const cleanName = name.trim().slice(0, 24) || `Игрок ${this.seats.length + 1}`;
    this.seats.push({ id, name: cleanName, professionId: professionId ?? null, dreamId: dreamId ?? null, bot: false, connected: true });
    this.hostId ??= id;
    return ok(undefined);
  }

  addBot(byId: string): Result {
    if (byId !== this.hostId) return err('Добавлять ботов может только создатель стола');
    if (this.started) return err('Партия уже началась');
    if (this.seats.length >= MAX_PLAYERS) return err('Все места заняты');
    this.botCount++;
    this.seats.push({ id: `bot-${this.botCount}`, name: `Бот ${this.botCount}`, professionId: null, dreamId: null, bot: true, connected: true });
    return ok(undefined);
  }

  /** Игрок ушёл: в лобби освобождает место, в партии за него ходит бот, пока он не вернётся. */
  leave(id: string): void {
    if (!this.started) {
      this.seats = this.seats.filter((s) => s.id !== id);
      if (this.hostId === id) this.hostId = this.seats.find((s) => !s.bot)?.id ?? null;
      return;
    }
    const seat = this.seats.find((s) => s.id === id);
    if (seat) seat.connected = false;
  }

  get humansConnected(): number {
    return this.seats.filter((s) => !s.bot && s.connected).length;
  }

  start(byId: string): Result {
    if (byId !== this.hostId) return err('Начать партию может только создатель стола');
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
  act(id: string, action: Record<string, unknown>): Result<GameEvent[]> {
    if (!this.game) return err('Партия ещё не началась');
    if (typeof action.type !== 'string') return err('Неверное действие');
    return this.apply({ ...action, playerId: id } as Action);
  }

  private apply(action: Action): Result<GameEvent[]> {
    const r = applyAction(this.content, this.game!, action);
    if (!r.ok) return err(r.error);
    this.game = r.state;
    return ok(r.events);
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
    if (!game || game.status !== 'playing') return null;
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
    return { hostId: this.hostId, mode: this.mode, seats: this.seats, game };
  }
}
