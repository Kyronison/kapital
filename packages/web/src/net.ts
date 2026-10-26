import type { GameMode } from '@kapital/content';
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

export interface ChatMessage {
  n: number;
  seatId: string;
  name: string;
  text: string;
  at: number;
}

export interface View {
  hostId: string | null;
  mode: GameMode;
  seats: Seat[];
  game: PublicGame | null;
  chat: ChatMessage[];
  turnDeadline: number | null;
}

/** Незаконченная партия на этом устройстве: по ключу место возвращается даже после перезапуска сервера. */
export interface SavedGame {
  saveId: string;
  key: string;
  seatId: string;
  players: string[];
  mode: GameMode;
  turn: number;
  savedAt: number;
}

const SAVES_KEY = 'kapital:saves';

export function loadSaves(): SavedGame[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVES_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as SavedGame[]) : [];
  } catch {
    return [];
  }
}

function writeSaves(list: SavedGame[]) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    // без localStorage архива просто не будет
  }
}

export function forgetSave(saveId: string) {
  writeSaves(loadSaves().filter((x) => x.saveId !== saveId));
}

interface SeatTicket {
  seatId: string;
  key: string;
  saveId: string;
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
  const [seat, setSeat] = useState<SeatTicket | null>(null);

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
    r.onMessage('seat', (t: SeatTicket) => setSeat(t));
    r.onLeave(() => {
      setRoom(null);
      setSeat(null);
      setView(null);
    });
    setRoom(r);
    // обработчики готовы: просим место и стол
    r.send('hello');
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

  // архив партий: запоминаем начатую партию и удаляем законченную
  useEffect(() => {
    if (!seat || !view?.game) return;
    if (view.game.status === 'finished') {
      forgetSave(seat.saveId);
      return;
    }
    const me = view.game.players.find((p) => p.id === seat.seatId);
    const entry: SavedGame = {
      ...seat,
      players: view.seats.map((x) => x.name),
      mode: view.mode,
      turn: me?.turnsTaken ?? 0,
      savedAt: Date.now(),
    };
    writeSaves([entry, ...loadSaves().filter((x) => x.saveId !== seat.saveId)]);
  }, [seat, view]);

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
    me: seat?.seatId ?? room?.sessionId ?? null,
    create: (opts: JoinOptions) => run(() => client.current.create(ROOM, opts)),
    join: (roomId: string, opts: JoinOptions) => run(() => client.current.joinById(roomId, opts)),
    // партия ещё идёт на сервере — входим в ту же комнату, иначе сервер поднимет её из сохранения
    resume: (save: SavedGame) => run(() =>
      client.current.joinById(save.saveId, { key: save.key })
        .catch(() => client.current.joinOrCreate(ROOM, { restore: save.saveId, key: save.key }))),
    leave: () => {
      void room?.leave(true);
      const url = new URL(location.href);
      url.searchParams.delete('room');
      history.replaceState(null, '', url);
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        // нечего чистить
      }
    },
    say: (text: string) => room?.send('chat', text),
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
