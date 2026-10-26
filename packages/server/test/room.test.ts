import type { Server } from '@colyseus/core';
import { Client, type Room } from 'colyseus.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, ROOM_NAME, type TableView } from '../src/index.js';

const PORT = 2600 + Math.floor(Math.random() * 1000);
let server: Server;

beforeAll(async () => {
  server = createServer({ botDelayMs: 0, turnSeconds: 30 });
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
});
