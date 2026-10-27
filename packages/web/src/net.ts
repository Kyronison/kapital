import type { GameEvent } from '@kapital/engine';
import type { ChatMessage, ClientAction, JoinOptions, SeatTicket, ServerMessages, TableView } from '@kapital/protocol';
import { ticket } from './auth.js';
import { Client, type Room } from 'colyseus.js';

export type { ChatMessage, PublicGame, ReactionView as Reaction, Seat, TableView as View } from '@kapital/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';

const WS = location.protocol === 'https:' ? 'wss' : 'ws';
// при разработке сайт отдаёт Vite, а игра на порту 2567; собранный сайт раздаёт сам игровой сервер
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? `${WS}://${location.hostname}:2567` : `${WS}://${location.host}`);
export type { SaveSummary } from '@kapital/protocol';
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
    on('events', (batch) =>
      setLog((prev) => {
        // пачка стыкуется с журналом по сквозному номеру; при входе или пропуске заменяет его целиком
        const next = prev.start + prev.events.length;
        const all = batch.start === next ? [...prev.events, ...batch.events]
          : batch.start > next || batch.start < prev.start ? batch.events
          : [...prev.events.slice(0, batch.start - prev.start), ...batch.events];
        const start = batch.start === next ? prev.start : batch.start > next || batch.start < prev.start ? batch.start : prev.start;
        const drop = Math.max(0, all.length - 200);
        return { events: all.slice(drop), start: start + drop };
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
    ticket().then((t) => {
      client.current.auth.token = t;
      return client.current.reconnect(token);
    }).then(attach).catch(() => {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        // нечего чистить
      }
    });
  }, [attach]);

  // в комнату пускают по билету аккаунта: он одноразовый, поэтому берётся перед каждым подключением
  const run = useCallback(async (f: () => Promise<Room>) => {
    setError(null);
    try {
      client.current.auth.token = await ticket();
      attach(await f());
    } catch (e) {
      const text = e instanceof Error ? e.message : '';
      // Colyseus отвечает по-английски, когда комнаты уже нет: партия закончилась или ссылка старая
      setError(/not found|не найден/i.test(text) ? 'Этой игры уже нет: партия закончилась или ссылка устарела.' : text || 'Не удалось подключиться к серверу');
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
    me: seat?.seatId ?? null,
    create: (opts: JoinOptions) => run(() => client.current.create(ROOM, opts)),
    startLevel: (levelId: string) => run(() => client.current.create(ROOM, { levelId })),
    join: (roomId: string, opts: JoinOptions) => run(() => client.current.joinById(roomId, opts)),
    // партия ещё идёт на сервере — входим в ту же комнату, иначе сервер поднимет её из сохранения
    resume: (saveId: string) => run(() =>
      client.current.joinById(saveId).catch(() => client.current.joinOrCreate(ROOM, { restore: saveId }))),
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
