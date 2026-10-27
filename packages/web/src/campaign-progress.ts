import { useEffect, useSyncExternalStore } from 'react';
import { api } from './auth.js';

const LEGACY_KEY = 'kapital:campaign';

/** Лучший результат по каждому пройденному уровню, в звёздах. Хранится в аккаунте, здесь — копия. */
let current: Record<string, number> = {};
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Прогресс, накопленный до появления аккаунтов, один раз переезжает на сервер. */
function legacy(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export async function loadProgress(): Promise<void> {
  const old = legacy();
  current = Object.keys(old).length
    ? await api<Record<string, number>>('/api/progress', 'PUT', old)
    : await api<Record<string, number>>('/api/progress');
  loaded = true;
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // нечего чистить
  }
  notify();
}

export function resetProgress() {
  current = {};
  loaded = false;
  notify();
}

export function saveStars(levelId: string, stars: number) {
  if ((current[levelId] ?? 0) >= stars) return;
  current = { ...current, [levelId]: stars };
  notify();
  void api('/api/progress', 'PUT', { [levelId]: stars }).catch(() => undefined);
}

export function useProgress(): Record<string, number> {
  const progress = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  useEffect(() => {
    if (!loaded) void loadProgress().catch(() => undefined);
  }, []);
  return progress;
}
