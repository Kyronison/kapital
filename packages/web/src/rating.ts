import type { Rating } from '@kapital/protocol';
import { useSyncExternalStore } from 'react';
import { api } from './auth.js';

/** Рейтинг и свои итоги. Общая копия для шапки, профиля и таблицы; App обновляет её при каждом открытии раздела. */
let current: Rating | null = null;
const listeners = new Set<() => void>();

export async function loadRating(): Promise<void> {
  current = await api<Rating>('/api/rating');
  listeners.forEach((l) => l());
}

export function resetRating() {
  current = null;
  listeners.forEach((l) => l());
}

export function useRating(): Rating | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
