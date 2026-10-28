import type { Account, AuthProviders, SaveSummary } from '@kapital/protocol';
import { useCallback, useEffect, useState } from 'react';

/** Запрос к HTTP-API аккаунтов: cookie сессии идёт сама, ошибка сервера становится исключением с текстом. */
export async function api<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await r.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  if (!r.ok) throw new ApiError(data.error ?? 'Ошибка сервера', r.status);
  return data;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type AccountState =
  | { status: 'loading' }
  | { status: 'out'; providers: AuthProviders }
  | { status: 'in'; providers: AuthProviders; account: Account };

/** Вошедший игрок и способы входа, настроенные на сервере. */
export function useAccount() {
  const [state, setState] = useState<AccountState>({ status: 'loading' });
  const [providers, setProviders] = useState<AuthProviders>({ email: false, google: false, yandex: false, telegram: null });

  const refresh = useCallback(async () => {
    const [p, me] = await Promise.all([
      api<AuthProviders>('/api/auth/providers').catch(() => providers),
      api<Account>('/api/auth/me').catch(() => null),
    ]);
    setProviders(p);
    setState(me ? { status: 'in', providers: p, account: me } : { status: 'out', providers: p });
    return me;
    // providers нужны только как запасной вариант при недоступном сервере
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signedIn = (account: Account) => setState({ status: 'in', providers, account });

  return {
    state,
    refresh,
    sendCode: (email: string) => api('/api/auth/email/code', 'POST', { email }),
    /** Возвращает true, если вошли; false — если серверу нужно имя нового игрока. */
    verifyCode: async (email: string, code: string, name?: string, password?: string) => {
      const r = await api<Account | { needName: true }>('/api/auth/email/verify', 'POST', { email, code, name, password });
      if ('needName' in r) return false;
      signedIn(r);
      return true;
    },
    signInWithPassword: async (email: string, password: string) => signedIn(await api<Account>('/api/auth/email/password', 'POST', { email, password })),
    signInTelegram: async (data: Record<string, unknown>) => signedIn(await api<Account>('/api/auth/telegram', 'POST', data)),
    update: async (patch: { name?: string; password?: string; avatar?: string }) => signedIn(await api<Account>('/api/auth/me', 'PATCH', patch)),
    /** Отзыв согласия: аккаунт и всё, что с ним связано, удаляется на сервере. */
    deleteAccount: async () => {
      await api('/api/auth/me', 'DELETE');
      setState({ status: 'out', providers });
    },
    logout: async () => {
      await api('/api/auth/logout', 'POST').catch(() => undefined);
      setState({ status: 'out', providers });
    },
  };
}

export type AccountApi = ReturnType<typeof useAccount>;

/** Билет на подключение к комнате: одноразовый, живёт минуту. */
export const ticket = () => api<{ ticket: string }>('/api/auth/ticket', 'POST').then((r) => r.ticket);

export const listSaves = () => api<SaveSummary[]>('/api/saves');
export const hideSave = (saveId: string) => api(`/api/saves/${saveId}`, 'DELETE');

const INVITE_KEY = 'kapital:invite';

/** Вход через Яндекс или Google уводит со страницы и возвращает на «/»: приглашение переживает это в sessionStorage. */
export function keepInvite() {
  const room = new URLSearchParams(location.search).get('room');
  try {
    if (room) sessionStorage.setItem(INVITE_KEY, room);
  } catch {
    // без хранилища приглашение придётся открыть ещё раз
  }
}

/** После входа возвращает отложенное приглашение в адрес страницы. */
export function restoreInvite(): boolean {
  let room: string | null = null;
  try {
    room = sessionStorage.getItem(INVITE_KEY);
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    return false;
  }
  if (!room || new URLSearchParams(location.search).has('room')) return false;
  const url = new URL(location.href);
  url.searchParams.set('room', room);
  history.replaceState(null, '', url);
  return true;
}
