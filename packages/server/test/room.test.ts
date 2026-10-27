import type { Server } from '@colyseus/core';
import { Client, type Room } from 'colyseus.js';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SaveStore } from '../src/saves.js';
import { createServer, ROOM_NAME, type ChatMessage, type TableView } from '../src/index.js';

const SAVE_DIR = mkdtempSync(join(tmpdir(), 'kapital-saves-'));

const PORT = 2600 + Math.floor(Math.random() * 1000);
let server: Server;

beforeAll(async () => {
  server = createServer({ botDelayMs: 0, turnSeconds: 30, saves: new SaveStore(SAVE_DIR) });
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

function nextMessage<T>(room: Room, type: string, until: (m: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`нет сообщения ${type}`)), 5000);
    const off = room.onMessage(type, (m: T) => {
      if (!until(m)) return;
      clearTimeout(timer);
      off();
      resolve(m);
    });
  });
}

describe('комната', () => {
  it('стол по ссылке: создание, вход второго игрока, старт и первый ход', async () => {
    const client = new Client(`ws://localhost:${PORT}`);
    const host = await client.create(ROOM_NAME, { name: 'Аня', professionId: 'teacher' });
    host.onMessage('events', () => {});
    const guest = await client.joinById(host.roomId, { name: 'Боря' });
    guest.onMessage('events', () => {});
    guest.onMessage('view', () => {});

    const started = nextMessage<TableView>(host, 'view', (v) => v.game !== null);
    host.send('start');
    const view = await started;
    expect(view.seats.map((s) => s.name)).toEqual(['Аня', 'Боря']);
    expect(view.game!.players[0]!.professionId).toBe('teacher');
    expect((view.game as Record<string, unknown>).decks).toBeUndefined();

    // гость не может ходить не в свою очередь
    const error = nextMessage<{ error: string }>(guest, 'error');
    guest.send('action', { type: 'ROLL' });
    expect((await error).error).toMatch(/кубик/);

    const rolled = nextMessage<TableView>(host, 'view', (v) => v.game!.lastRoll !== null);
    host.send('action', { type: 'ROLL' });
    expect((await rolled).game!.players[0]!.turnsTaken).toBe(1);

    await guest.leave();
    await host.leave();
  });

  it('после старта в комнату нельзя войти новому игроку', async () => {
    const client = new Client(`ws://localhost:${PORT}`);
    const host = await client.create(ROOM_NAME, { name: 'Аня' });
    host.onMessage('*', () => {});
    const started = nextMessage<TableView>(host, 'view', (v) => v.game !== null);
    host.send('add_bot');
    host.send('start');
    await started;
    await new Promise((r) => setTimeout(r, 100));
    await expect(client.joinById(host.roomId, { name: 'Опоздавший' })).rejects.toThrow();
    await host.leave();
  });

  it('чат: сообщение видят все за столом', async () => {
    const client = new Client(`ws://localhost:${PORT}`);
    const host = await client.create(ROOM_NAME, { name: 'Аня' });
    host.onMessage('*', () => {});
    const guest = await client.joinById(host.roomId, { name: 'Боря' });
    guest.onMessage('*', () => {});
    const heard = nextMessage<ChatMessage[]>(guest, 'chat', (m) => m.length > 0);
    host.send('chat', '  Привет,   стол! ');
    expect((await heard).map((m) => [m.name, m.text])).toEqual([['Аня', 'Привет, стол!']]);
    await guest.leave();
    await host.leave();
  });

  it('партия сохраняется, когда все ушли, и продолжается по ключу места', async () => {
    const client = new Client(`ws://localhost:${PORT}`);
    const host = await client.create(ROOM_NAME, { name: 'Аня' });
    host.onMessage('*', () => {});
    const hello = nextMessage<{ seatId: string; key: string; saveId: string }>(host, 'seat');
    host.send('hello');
    const seat = await hello;
    const started = nextMessage<TableView>(host, 'view', (v) => v.game !== null);
    host.send('add_bot');
    host.send('start');
    await started;
    const rolled = nextMessage<TableView>(host, 'view', (v) => v.game!.lastRoll !== null);
    host.send('action', { type: 'ROLL' });
    await rolled;
    await host.leave();
    await new Promise((r) => setTimeout(r, 300));
    expect(existsSync(join(SAVE_DIR, `${seat.saveId}.json`))).toBe(true);

    await expect(client.joinOrCreate(ROOM_NAME, { restore: seat.saveId, key: 'чужой' })).rejects.toThrow();
    const back = await client.joinOrCreate(ROOM_NAME, { restore: seat.saveId, key: seat.key });
    back.onMessage('*', () => {});
    const again = nextMessage<{ seatId: string }>(back, 'seat');
    const viewed = nextMessage<TableView>(back, 'view');
    back.send('hello');
    expect((await again).seatId).toBe(seat.seatId);
    const view = await viewed;
    expect(view.game!.players[0]!.turnsTaken).toBe(1);
    expect(view.game!.players[0]!.id).toBe(seat.seatId);
    // ход продолжается с того же места: можно завершить ход
    const ended = nextMessage<TableView>(back, 'view', (v) => v.game!.current === 1);
    back.send('action', { type: 'END_TURN' });
    await ended;
    await back.leave();
  });
});
