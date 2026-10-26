import type { GameEvent, GameState } from '@kapital/engine';
import { Client, type Room } from 'colyseus.js';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Seat {
  id: string;
  name: string;
  professionId: string | null;
  dreamId: string | null;
  bot: boolean;
  connected: boolean;
}

export type PublicGame = Omit<GameState, 'decks' | 'rng' | 'seed'>;

export interface View {
  hostId: string | null;
  seats: Seat[];
  game: PublicGame | null;
  turnDeadline: number | null;
}

export interface JoinOptions {
  name: string;
  professionId?: string;
  dreamId?: string;
}

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`;
const ROOM = 'kapital';
const TOKEN_KEY = 'kapital:reconnect';

export function useTable() {
  const client = useRef(new Client(SERVER_URL));
  const [room, setRoom] = useState<Room | null>(null);
  const [view, setView] = useState<View | null>(null);
  // журнал хранит последние 200 событий; logStart — номер первого из них с начала партии
  const [log, setLog] = useState<{ events: GameEvent[]; start: number }>({ events: [], start: 0 });
  const [error, setError] = useState<string | null>(null);

  const attach = useCallback((r: Room) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, r.reconnectionToken);
    } catch {
      // без sessionStorage просто не будет переподключения после перезагрузки
    }
    r.onMessage('view', (v: View) => setView(v));
    r.onMessage('events', (e: GameEvent[]) =>
      setLog((prev) => {
        const all = [...prev.events, ...e];
        const drop = Math.max(0, all.length - 200);
        return { events: all.slice(drop), start: prev.start + drop };
      }),
    );
    r.onMessage('error', (m: { error: string }) => setError(m.error));
    r.onLeave(() => setRoom(null));
    setRoom(r);
    const url = new URL(location.href);
    url.searchParams.set('room', r.roomId);
    history.replaceState(null, '', url);
  }, []);

  // после перезагрузки страницы пробуем вернуться на своё место
  useEffect(() => {
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token) return;
    client.current.reconnect(token).then(attach).catch(() => {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        // нечего чистить
      }
    });
  }, [attach]);

  const run = useCallback(async (f: () => Promise<Room>) => {
    setError(null);
    try {
      attach(await f());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подключиться к серверу');
    }
  }, [attach]);

  return {
    room,
    view,
    log: log.events,
    logStart: log.start,
    error,
    clearError: () => setError(null),
    me: room?.sessionId ?? null,
    create: (opts: JoinOptions) => run(() => client.current.create(ROOM, opts)),
    join: (roomId: string, opts: JoinOptions) => run(() => client.current.joinById(roomId, opts)),
    send: (type: string, payload?: unknown) => {
      setError(null);
      room?.send(type, payload);
    },
    act: (action: Record<string, unknown>) => {
      setError(null);
      room?.send('action', action);
    },
  };
}

export type TableApi = ReturnType<typeof useTable>;
