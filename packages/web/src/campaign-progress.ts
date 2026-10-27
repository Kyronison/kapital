import { useEffect, useSyncExternalStore } from 'react';
import { api } from './auth.js';

/** Лучший результат по каждому пройденному уровню, в звёздах. Хранится в аккаунте, здесь — копия. */
let current: Record<string, number> = {};
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export async function loadProgress(): Promise<void> {
  current = await api<Record<string, number>>('/api/progress');
  loaded = true;
  notify();
}

export function resetProgress() {
  current = {};
  loaded = false;
  notify();
}

/** Звёзды в аккаунт записывает сервер по итогу уровня; здесь — только копия, чтобы карта обновилась сразу. */
export function saveStars(levelId: string, stars: number) {
  if ((current[levelId] ?? 0) >= stars) return;
  current = { ...current, [levelId]: stars };
  notify();
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
