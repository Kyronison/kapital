import type { Server } from '@colyseus/core';
import { Client, type Room } from 'colyseus.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Auth, createServer, Db, ROOM_NAME, type ChatMessage, type TableView } from '../src/index.js';

const PORT = 2600 + Math.floor(Math.random() * 1000);
let server: Server;
const db = Db.memory();
const auth = new Auth(db);

/** Клиент вошедшего игрока: каждое подключение к комнате идёт по свежему билету. */
function as(name: string): Client {
  const id = `u-${name}`;
  if (!db.user(id)) db.createUser(id, name, null);
  const client = new Client(`ws://localhost:${PORT}`);
  const ticket = () => auth.ticket(id);
  const wrap = <K extends 'create' | 'joinById' | 'joinOrCreate'>(k: K) => {
    const orig = (client[k] as (...a: unknown[]) => Promise<Room>).bind(client);
    (client as unknown as Record<string, unknown>)[k] = (...a: unknown[]) => {
      client.auth.token = ticket();
      return orig(...a);
    };
  };
  wrap('create');
  wrap('joinById');
  wrap('joinOrCreate');
  return client;
}

beforeAll(async () => {
  server = createServer(auth, { botDelayMs: 0, turnSeconds: 30 });
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
    const host = await as('Аня').create(ROOM_NAME, { professionId: 'teacher' });
    host.onMessage('events', () => {});
    const guest = await as('Боря').joinById(host.roomId);
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
    const host = await as('Аня').create(ROOM_NAME);
    host.onMessage('*', () => {});
    const started = nextMessage<TableView>(host, 'view', (v) => v.game !== null);
    host.send('add_bot');
    host.send('start');
    await started;
    await new Promise((r) => setTimeout(r, 100));
    await expect(as('Опоздавший').joinById(host.roomId)).rejects.toThrow();
    // без билета или сессии в комнату не пускают вовсе
    await expect(new Client(`ws://localhost:${PORT}`).joinById(host.roomId)).rejects.toThrow(/войти/);
    await host.leave();
  });

  it('чат: сообщение видят все за столом', async () => {
    const host = await as('Аня').create(ROOM_NAME);
    host.onMessage('*', () => {});
    const guest = await as('Боря').joinById(host.roomId);
    guest.onMessage('*', () => {});
    const heard = nextMessage<ChatMessage[]>(guest, 'chat', (m) => m.length > 0);
    host.send('chat', '  Привет,   стол! ');
    expect((await heard).map((m) => [m.name, m.text])).toEqual([['Аня', 'Привет, стол!']]);
    await guest.leave();
    await host.leave();
  });

  it('партия сохраняется, когда все ушли, и продолжается из аккаунта', async () => {
    const client = as('Аня');
    const host = await client.create(ROOM_NAME);
    host.onMessage('*', () => {});
    const hello = nextMessage<{ seatId: string; saveId: string }>(host, 'seat');
    host.send('hello');
    const seat = await hello;
    expect(seat.seatId).toBe('u-Аня');
    const started = nextMessage<TableView>(host, 'view', (v) => v.game !== null);
    host.send('add_bot');
    host.send('start');
    await started;
    const rolled = nextMessage<TableView>(host, 'view', (v) => v.game!.lastRoll !== null);
    host.send('action', { type: 'ROLL' });
    await rolled;
    await host.leave();
    await new Promise((r) => setTimeout(r, 300));
    expect(db.savesOf('u-Аня').map((x) => x.saveId)).toContain(seat.saveId);
    expect(db.savesOf('u-Никто')).toHaveLength(0);

    // чужой аккаунт в сохранённую партию не попадает
    await expect(as('Боря').joinOrCreate(ROOM_NAME, { restore: seat.saveId })).rejects.toThrow();
    const back = await client.joinOrCreate(ROOM_NAME, { restore: seat.saveId });
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
