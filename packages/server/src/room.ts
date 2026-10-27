import { Room, type Client, type Delayed } from '@colyseus/core';
import { defaultContent, type Content } from '@kapital/content';
import type { GameEvent } from '@kapital/engine';
import { SaveStore } from './saves.js';
import { Table, type Result } from './table.js';

export interface RoomOptions {
  /** Сколько секунд даётся на ход, потом за игрока доигрывает бот. */
  turnSeconds?: number;
  /** Пауза перед ходом бота, чтобы люди успевали следить за партией. */
  botDelayMs?: number;
  /** Сколько секунд держится место отключившегося игрока. */
  reconnectSeconds?: number;
  content?: Content;
  /** Где хранить незаконченные партии; null — не сохранять. */
  saves?: SaveStore | null;
}

/** Параметры создания комнаты от клиента: restore — номер сохранённой партии. */
export interface CreateOptions {
  restore?: string;
  /** Уровень «Тренировки»: стол на одного, партия начинается сразу. */
  levelId?: string;
}

export interface JoinOptions {
  name?: string;
  professionId?: string;
  dreamId?: string;
  /** Ключ места: с ним клиент возвращается в сохранённую партию. */
  key?: string;
}

/**
 * Комната одной партии. Клиент только присылает намерения; правила проверяет движок.
 * Сообщения клиента: `hello`, `action` (действие движка), `start`, `add_bot`, `set_mode`, `chat`,
 * `pass` (не продавать по открытой цене, пока ход ждёт ответа соперников).
 * Сообщения сервера: `view` (стол без скрытых данных), `events`, `error` и `seat` — только своему
 * клиенту: id места, ключ возврата и номер сохранения.
 */
export class KapitalRoom extends Room {
  maxClients = 6;
  private table!: Table;
  private opts!: Required<Omit<RoomOptions, 'content' | 'saves'>>;
  private saves: SaveStore | null = null;
  private saveId = '';
  private saving: Promise<void> = Promise.resolve();
  private botTimer: Delayed | null = null;
  private holdTimer: Delayed | null = null;
  private turnTimer: Delayed | null = null;
  private turnKey = '';
  private turnDeadline: number | null = null;

  async onCreate(options: RoomOptions & CreateOptions = {}) {
    const content = options.content ?? defaultContent;
    this.saves = options.saves ?? null;
    if (options.restore) {
      const snap = await this.saves?.load(options.restore);
      if (!snap) throw new Error('Сохранённая партия не найдена');
      this.table = Table.restore(content, snap);
      // не запираем: второй игрок той же партии должен найти эту комнату по restore
      this.saveId = options.restore;
    } else {
      this.table = new Table(content);
      this.saveId = this.roomId;
      if (options.levelId) {
        const r = this.table.setLevel(options.levelId);
        if (!r.ok) throw new Error(r.error);
      }
    }
    this.opts = {
      turnSeconds: options.turnSeconds ?? 30,
      botDelayMs: options.botDelayMs ?? 700,
      reconnectSeconds: options.reconnectSeconds ?? 60,
    };

    this.onMessage('action', (client, message: unknown) => {
      if (typeof message !== 'object' || message === null) return this.reply(client, { ok: false, error: 'Неверное действие' });
      this.handle(client, this.table.act(client.sessionId, message as Record<string, unknown>));
    });
    this.onMessage('start', (client) => {
      // комнату не запираем: вернуться по ключу места можно и после старта, новых игроков не пустит стол
      this.handle(client, this.table.start(client.sessionId));
    });
    this.onMessage('add_bot', (client) => this.handle(client, this.table.addBot(client.sessionId)));
    this.onMessage('set_mode', (client, mode: unknown) => this.handle(client, this.table.setMode(client.sessionId, mode)));
    // клиент подписался на сообщения и просит своё место и стол: в onJoin он мог их не успеть принять
    this.onMessage('hello', (client) => {
      const seatId = this.table.seatOf(client.sessionId);
      const key = this.table.keyOf(seatId);
      if (key) client.send('seat', { seatId, key, saveId: this.saveId });
      client.send('view', { ...this.table.view(), turnDeadline: this.turnDeadline });
    });
    this.onMessage('pass', (client) => this.handle(client, this.table.pass(client.sessionId)));
    this.onMessage('chat', (client, text: unknown) => this.handle(client, this.table.say(client.sessionId, text)));
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const key = typeof options.key === 'string' ? options.key : undefined;
    const r = this.table.join(client.sessionId, String(options.name ?? ''), options.professionId, options.dreamId, key);
    if (!r.ok) throw new Error(r.error);
    client.send('seat', { ...r.value, saveId: this.saveId });
    if (this.table.level && !this.table.started) this.table.start(client.sessionId);
    this.publish([]);
  }

  async onLeave(client: Client, consented?: boolean) {
    this.publish(this.table.leave(client.sessionId));
    if (consented || !this.table.started) return;
    try {
      await this.allowReconnection(client, this.opts.reconnectSeconds);
      const r = this.table.join(client.sessionId, '');
      if (r.ok) client.send('seat', { ...r.value, saveId: this.saveId });
      this.publish([]);
    } catch {
      // не вернулся: место остаётся за ботом
    }
  }

  async onDispose() {
    this.botTimer?.clear();
    this.turnTimer?.clear();
    this.holdTimer?.clear();
    this.persist();
    await this.saving;
  }

  /** Незаконченная партия пишется на диск, законченная удаляется. Записи идут строго по очереди. */
  private persist() {
    const saves = this.saves;
    if (!saves || !this.table.started) return;
    const finished = this.table.game!.status === 'finished';
    const snap = finished ? null : structuredClone(this.table.snapshot());
    this.saving = this.saving
      .then(() => (snap ? saves.save(this.saveId, snap) : saves.remove(this.saveId)))
      .catch((e: unknown) => console.error('Не удалось сохранить партию', e));
  }

  private reply(client: Client, r: Result<unknown>) {
    if (!r.ok) client.send('error', { error: r.error });
  }

  private handle(client: Client, r: Result<GameEvent[] | void>) {
    this.reply(client, r);
    if (r.ok) this.publish(Array.isArray(r.value) ? r.value : []);
  }

  private publish(events: GameEvent[]) {
    this.resetTurnTimer();
    this.resetHoldTimer();
    if (events.length) this.broadcast('events', events);
    this.broadcast('view', { ...this.table.view(), turnDeadline: this.turnDeadline });
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
    if (!seat || seat.bot || !seat.connected || solo) {
      this.turnTimer = null;
      this.turnDeadline = null;
      return;
    }
    const ms = this.opts.turnSeconds * 1000;
    this.turnDeadline = Date.now() + ms;
    this.turnTimer = this.clock.setTimeout(() => {
      this.turnTimer = null;
      this.publish(this.table.timeout());
    }, ms);
  }
}
