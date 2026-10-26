import { useSyncExternalStore } from 'react';

/** Настройки этого устройства. */
export interface Settings {
  /** Подсказки наставника для новичков. */
  hints: boolean;
  /** После сделок раскладывать строки по разделам отчёта самому. */
  fillReport: boolean;
  /** Какие подсказки уже прочитаны. */
  seenHints: string[];
  /** Счёт режима «Заполни отчёт». */
  reportRight: number;
  reportTotal: number;
}

const KEY = 'kapital:settings';
const DEFAULTS: Settings = { hints: true, fillReport: false, seenHints: [], reportRight: 0, reportTotal: 0 };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  current = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // настройки проживут до перезагрузки
  }
  listeners.forEach((l) => l());
}

/** Общие для всех компонентов настройки: изменение в одном месте видно везде. */
export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
