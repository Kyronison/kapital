import { Room, type Client, type Delayed } from '@colyseus/core';
import { defaultContent, type Content } from '@kapital/content';
import type { GameEvent } from '@kapital/engine';
import { Table, type Result } from './table.js';

export interface RoomOptions {
  /** Сколько секунд даётся на ход, потом за игрока доигрывает бот. */
  turnSeconds?: number;
  /** Пауза перед ходом бота, чтобы люди успевали следить за партией. */
  botDelayMs?: number;
  /** Сколько секунд держится место отключившегося игрока. */
  reconnectSeconds?: number;
  content?: Content;
}

export interface JoinOptions {
  name?: string;
  professionId?: string;
  dreamId?: string;
}

/**
 * Комната одной партии. Клиент только присылает намерения; правила проверяет движок.
 * Сообщения клиента: `action` (действие движка), `start`, `add_bot`.
 * Сообщения сервера: `view` (стол без скрытых данных), `events`, `error`.
 */
export class KapitalRoom extends Room {
  maxClients = 6;
  private table!: Table;
  private opts!: Required<Omit<RoomOptions, 'content'>>;
  private botTimer: Delayed | null = null;
  private turnTimer: Delayed | null = null;
  private turnKey = '';
  private turnDeadline: number | null = null;

  onCreate(options: RoomOptions = {}) {
    this.table = new Table(options.content ?? defaultContent);
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
      const r = this.table.start(client.sessionId);
      if (r.ok) void this.lock();
      this.handle(client, r);
    });
    this.onMessage('add_bot', (client) => this.handle(client, this.table.addBot(client.sessionId)));
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const r = this.table.join(client.sessionId, String(options.name ?? ''), options.professionId, options.dreamId);
    if (!r.ok) throw new Error(r.error);
    this.publish([]);
  }

  async onLeave(client: Client, consented?: boolean) {
    this.table.leave(client.sessionId);
    this.publish([]);
    if (consented || !this.table.started) return;
    try {
      await this.allowReconnection(client, this.opts.reconnectSeconds);
      this.table.join(client.sessionId, '');
      this.publish([]);
    } catch {
      // не вернулся: место остаётся за ботом
    }
  }

  onDispose() {
    this.botTimer?.clear();
    this.turnTimer?.clear();
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
    if (events.length) this.broadcast('events', events);
    this.broadcast('view', { ...this.table.view(), turnDeadline: this.turnDeadline });
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
    if (!seat || seat.bot || !seat.connected) {
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
