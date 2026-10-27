import { Room, type AuthContext, type Client, type Delayed } from '@colyseus/core';
import { defaultContent, type Content } from '@kapital/content';
import type { GameEvent } from '@kapital/engine';
import { DEFAULT_TURN_SECONDS, type ChatMessage, type CreateOptions, type JoinOptions, type ServerMessages } from '@kapital/protocol';
import { parseCookies, SESSION_COOKIE } from './api.js';
import type { Auth } from './auth.js';
import type { User } from './db.js';
import { Table, type Result } from './table.js';

export interface RoomOptions {
  /** Сколько секунд даётся на ход по умолчанию, потом за игрока доигрывает бот; создатель стола может сменить в лобби. */
  turnSeconds?: number;
  /** Пауза перед ходом бота, чтобы люди успевали следить за партией. */
  botDelayMs?: number;
  /** Сколько секунд держится место отключившегося игрока. */
  reconnectSeconds?: number;
  content?: Content;
  /** Аккаунты: без входа в комнату не пускают, незаконченные партии хранятся в той же базе. */
  auth: Auth;
}

/**
 * Комната одной партии. Клиент только присылает намерения; правила проверяет движок.
 * Сообщения клиента: `hello`, `action` (действие движка), `start`, `add_bot`, `set_mode`, `set_turn_seconds`, `chat`,
 * `pass` (не продавать по открытой цене, пока ход ждёт ответа соперников).
 * Сообщения сервера: `view` (стол без скрытых данных), `events`, `chat`; `error` и `seat` — только своему
 * клиенту: id места, ключ возврата и номер сохранения. Формы — в @kapital/protocol.
 */
export class KapitalRoom extends Room {
  maxClients = 6;
  private table!: Table;
  private opts!: Required<Omit<RoomOptions, 'content' | 'auth'>>;
  private auth!: Auth;
  private saveId = '';
  private botTimer: Delayed | null = null;
  private holdTimer: Delayed | null = null;
  private turnTimer: Delayed | null = null;
  private turnKey = '';
  private turnDeadline: number | null = null;

  async onCreate(options: RoomOptions & CreateOptions) {
    const content = options.content ?? defaultContent;
    this.auth = options.auth;
    if (options.restore) {
      const snap = this.auth.db.loadTable(options.restore);
      if (!snap) throw new Error('Сохранённая партия не найдена');
      this.table = Table.restore(content, snap);
      // не запираем: второй игрок той же партии должен найти эту комнату по restore
      this.saveId = options.restore;
    } else {
      this.table = new Table(content);
      this.table.turnSeconds = options.turnSeconds ?? DEFAULT_TURN_SECONDS;
      this.saveId = this.roomId;
      if (options.levelId) {
        const r = this.table.setLevel(options.levelId);
        if (!r.ok) throw new Error(r.error);
      }
    }
    this.opts = {
      turnSeconds: options.turnSeconds ?? DEFAULT_TURN_SECONDS,
      botDelayMs: options.botDelayMs ?? 700,
      reconnectSeconds: options.reconnectSeconds ?? 60,
    };

    this.onMessage('action', (client, message: unknown) => this.handle(client, this.table.act(client.sessionId, message)));
    this.onMessage('start', (client) => {
      // комнату не запираем: вернуться по ключу места можно и после старта, новых игроков не пустит стол
      this.handle(client, this.table.start(client.sessionId));
    });
    this.onMessage('add_bot', (client) => this.handle(client, this.table.addBot(client.sessionId)));
    this.onMessage('set_mode', (client, mode: unknown) => this.handle(client, this.table.setMode(client.sessionId, mode)));
    this.onMessage('set_turn_seconds', (client, s: unknown) => this.handle(client, this.table.setTurnSeconds(client.sessionId, s)));
    // клиент подписался на сообщения и просит своё место и стол: в onJoin он мог их не успеть принять
    this.onMessage('hello', (client) => {
      this.tell(client, 'seat', { seatId: this.table.seatOf(client.sessionId), saveId: this.saveId });
      this.tell(client, 'view', { ...this.table.view(), turnDeadline: this.turnDeadline });
      this.tell(client, 'chat', this.table.chat);
      if (this.table.log.events.length) this.tell(client, 'events', this.table.log);
    });
    this.onMessage('pass', (client) => this.handle(client, this.table.pass(client.sessionId)));
    this.onMessage('chat', (client, text: unknown) => {
      const r = this.table.say(client.sessionId, text);
      this.reply(client, r);
      if (r.ok) {
        this.broadcast('chat', [r.value] satisfies ChatMessage[]);
        this.persist();
      }
    });
  }

  /** В комнату пускают по билету из /api/auth/ticket или по cookie сессии; аккаунт становится местом за столом. */
  onAuth(_client: Client, _options: unknown, context: AuthContext): User {
    const user = this.auth.userFromTicket(context.token) ?? this.auth.userFromSession(parseCookies(context.headers.cookie)[SESSION_COOKIE]);
    if (!user) throw new Error('Нужно войти в аккаунт');
    return user;
  }

  onJoin(client: Client<unknown, User>, options: JoinOptions = {}) {
    const user = client.auth!;
    const r = this.table.join(client.sessionId, { id: user.id, name: user.name }, options.professionId, options.dreamId);
    if (!r.ok) throw new Error(r.error);
    this.tell(client, 'seat', { ...r.value, saveId: this.saveId });
    if (this.table.level && !this.table.started) this.table.start(client.sessionId);
    this.publish([]);
  }

  async onLeave(client: Client<unknown, User>, consented?: boolean) {
    this.publish(this.table.leave(client.sessionId));
    if (consented || !this.table.started) return;
    try {
      await this.allowReconnection(client, this.opts.reconnectSeconds);
      const user = client.auth!;
      const r = this.table.join(client.sessionId, { id: user.id, name: user.name });
      if (r.ok) this.tell(client, 'seat', { ...r.value, saveId: this.saveId });
      this.publish([]);
    } catch {
      // не вернулся: место остаётся за ботом
    }
  }

  onDispose() {
    this.botTimer?.clear();
    this.turnTimer?.clear();
    this.holdTimer?.clear();
    this.persist();
  }

  /**
   * Незаконченная партия пишется в базу зашифрованной и видна в списке каждому игроку за столом;
   * у законченной остаётся только итог для рейтинга.
   */
  private persist() {
    if (!this.table.started) return;
    try {
      const outcome = this.table.outcome();
      if (outcome) {
        this.auth.db.recordGame(this.saveId, outcome);
        this.auth.db.removeTable(this.saveId);
      }
      else this.auth.db.saveTable(this.saveId, this.table.snapshot(), this.table.seats.filter((s) => !s.bot).map((s) => s.id));
    } catch (e) {
      console.error('Не удалось сохранить партию', e);
    }
  }

  /** Типизированная отправка: имя и форма сообщения берутся из протокола. */
  private tell<K extends keyof ServerMessages>(client: Client, type: K, payload: ServerMessages[K]) {
    client.send(type, payload);
  }

  private reply(client: Client, r: Result<unknown>) {
    if (!r.ok) this.tell(client, 'error', { error: r.error });
  }

  private handle(client: Client, r: Result<GameEvent[] | void>) {
    this.reply(client, r);
    if (r.ok) this.publish(Array.isArray(r.value) ? r.value : []);
  }

  private publish(events: GameEvent[]) {
    this.resetTurnTimer();
    this.resetHoldTimer();
    if (events.length) {
      // номер первого из новых событий: они уже записаны в журнал стола последними
      const start = this.table.log.start + this.table.log.events.length - events.length;
      this.broadcast('events', { start, events } satisfies ServerMessages['events']);
    }
    this.broadcast('view', { ...this.table.view(), turnDeadline: this.turnDeadline } satisfies ServerMessages['view']);
    this.persist();
    this.scheduleBots();
  }

  private scheduleBots() {
    if (this.botTimer) return;
    this.botTimer = this.clock.setTimeout(() => {
      this.botTimer = null;
      const events = this.table.botStep();
      if (events) this.publish(events);
    }, this.opts.botDelayMs);
  }

  /** Окно ответа соперников закрывается по времени, даже если кто-то молчит. */
  private resetHoldTimer() {
    const reaction = this.table.reaction;
    if (!reaction) {
      this.holdTimer?.clear();
      this.holdTimer = null;
      return;
    }
    if (this.holdTimer) return;
    this.holdTimer = this.clock.setTimeout(() => {
      this.holdTimer = null;
      this.publish(this.table.expireHold());
    }, Math.max(0, reaction.until - Date.now()));
  }

  /** Таймер на весь ход человека; у ботов и отключившихся таймера нет. */
  private resetTurnTimer() {
    const game = this.table.game;
    if (!game || game.status !== 'playing') {
      this.turnTimer?.clear();
      this.turnTimer = null;
      this.turnDeadline = null;
      return;
    }
    const current = game.players[game.current]!;
    // turnsTaken растёт при броске, поэтому до броска это ещё «следующий» ход
    const turnKey = `${current.id}:${current.turnsTaken + (game.phase === 'roll' ? 1 : 0)}`;
    if (turnKey === this.turnKey) return;
    this.turnKey = turnKey;
    this.turnTimer?.clear();
    const seat = this.table.seats.find((s) => s.id === current.id);
    // в одиночной партии никто не ждёт, поэтому таймера нет
    const solo = this.table.seats.length === 1;
    if (!seat || seat.bot || !seat.connected || solo || this.table.turnSeconds === 0) {
      this.turnTimer = null;
      this.turnDeadline = null;
      return;
    }
    const ms = this.table.turnSeconds * 1000;
    this.turnDeadline = Date.now() + ms;
    this.turnTimer = this.clock.setTimeout(() => {
      this.turnTimer = null;
      this.publish(this.table.timeout());
    }, ms);
  }
}
