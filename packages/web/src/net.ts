import type { GameMode } from '@kapital/content';
import type { GameEvent } from '@kapital/engine';
import type { ChatMessage, ClientAction, JoinOptions, SeatTicket, ServerMessages, TableView } from '@kapital/protocol';
import { Client, type Room } from 'colyseus.js';

export type { ChatMessage, PublicGame, ReactionView as Reaction, Seat, TableView as View } from '@kapital/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';

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

const WS = location.protocol === 'https:' ? 'wss' : 'ws';
// при разработке сайт отдаёт Vite, а игра на порту 2567; собранный сайт раздаёт сам игровой сервер
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? `${WS}://${location.hostname}:2567` : `${WS}://${location.host}`);
const ROOM = 'kapital';
const TOKEN_KEY = 'kapital:reconnect';

export function useTable() {
  const client = useRef(new Client(SERVER_URL));
  const [room, setRoom] = useState<Room | null>(null);
  const [view, setView] = useState<TableView | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  // журнал хранит последние 200 событий; logStart — номер первого из них с начала партии
  const [log, setLog] = useState<{ events: GameEvent[]; start: number }>({ events: [], start: 0 });
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<SeatTicket | null>(null);
  const current = useRef<Room | null>(null);

  const attach = useCallback((r: Room) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, r.reconnectionToken);
    } catch {
      // без sessionStorage просто не будет переподключения после перезагрузки
    }
    // имена и формы сообщений — из протокола, тот же тип использует сервер
    const on = <K extends keyof ServerMessages>(type: K, handler: (payload: ServerMessages[K]) => void) =>
      r.onMessage(type, (payload: ServerMessages[K]) => current.current === r && handler(payload));
    on('view', setView);
    on('events', (e) =>
      setLog((prev) => {
        const all = [...prev.events, ...e];
        const drop = Math.max(0, all.length - 200);
        return { events: all.slice(drop), start: prev.start + drop };
      }),
    );
    on('error', (m) => setError(m.error));
    on('seat', setSeat);
    // при входе приходит весь чат, затем по одному сообщению
    on('chat', (list) => setChat((prev) => [...prev.filter((m) => !list.some((x) => x.n === m.n)), ...list].slice(-50)));
    r.onLeave(() => {
      // старая комната могла закрыться уже после входа в новую: тогда ничего не трогаем
      if (current.current !== r) return;
      current.current = null;
      setRoom(null);
      setSeat(null);
      setView(null);
      setChat([]);
      setLog({ events: [], start: 0 });
    });
    current.current = r;
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
    chat,
    log: log.events,
    logStart: log.start,
    error,
    clearError: () => setError(null),
    me: seat?.seatId ?? room?.sessionId ?? null,
    create: (opts: JoinOptions) => run(() => client.current.create(ROOM, opts)),
    startLevel: (levelId: string, name: string) => run(() => client.current.create(ROOM, { levelId, name })),
    join: (roomId: string, opts: JoinOptions) => run(() => client.current.joinById(roomId, opts)),
    // партия ещё идёт на сервере — входим в ту же комнату, иначе сервер поднимет её из сохранения
    resume: (save: SavedGame) => run(() =>
      client.current.joinById(save.saveId, { key: save.key })
        .catch(() => client.current.joinOrCreate(ROOM, { restore: save.saveId, key: save.key }))),
    leave: () => {
      const r = current.current;
      current.current = null;
      setRoom(null);
      setSeat(null);
      setView(null);
      setChat([]);
      setLog({ events: [], start: 0 });
      void r?.leave(true);
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
    act: (action: ClientAction) => {
      setError(null);
      room?.send('action', action);
    },
  };
}

export type TableApi = ReturnType<typeof useTable>;
