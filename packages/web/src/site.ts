import type { SiteInfo } from '@kapital/protocol';
import { useEffect, useState } from 'react';
import { api } from './auth.js';

const NO_SITE: SiteInfo = { operator: null, contact: null, metrika: null };
let loading: Promise<SiteInfo> | null = null;

/** Оператор данных, почта для запросов и счётчик: один запрос на всю страницу. */
export function loadSite(): Promise<SiteInfo> {
  loading ??= api<SiteInfo>('/api/site').catch(() => NO_SITE);
  return loading;
}

export function useSite(): SiteInfo | null {
  const [site, setSite] = useState<SiteInfo | null>(null);
  useEffect(() => {
    void loadSite().then(setSite);
  }, []);
  return site;
}

// --- согласие на обработку данных ---

const CONSENT_KEY = 'kapital:consent';

/** Галочка согласия запоминается в браузере, чтобы не ставить её при каждом входе. */
export function consentGiven(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== null;
  } catch {
    return false;
  }
}

export function rememberConsent(given: boolean) {
  try {
    if (given) localStorage.setItem(CONSENT_KEY, new Date().toISOString());
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // без хранилища галочку придётся поставить ещё раз
  }
}

// --- Яндекс Метрика ---

/** Цели воронки: от входа до доигранной партии. Их же нужно завести в настройках счётчика. */
export type Goal = 'signed_in' | 'level_started' | 'level_won' | 'game_started' | 'game_finished' | 'invite_opened' | 'account_deleted';

type Ym = ((id: number, method: string, ...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
declare global {
  interface Window {
    ym?: Ym;
  }
}

let counter: number | null = null;

/**
 * Счётчик подключается, только если его номер задан на сервере. Вебвизор выключен:
 * он записывает ввод на странице, а там почта и имя.
 */
export async function startMetrika() {
  const { metrika } = await loadSite();
  if (!metrika || counter !== null) return;
  counter = Number(metrika);
  const ym: Ym = Object.assign((...args: unknown[]) => { (ym.a ??= []).push(args); }, { l: Date.now() });
  window.ym = ym;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(script);
  // разделы кабинета живут в #, поэтому переходы между ними считаются отдельными страницами
  ym(counter, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, trackHash: true, webvisor: false });
}

export function goal(name: Goal) {
  if (counter !== null) window.ym?.(counter, 'reachGoal', name);
}
