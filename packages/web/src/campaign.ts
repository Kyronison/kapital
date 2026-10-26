import { levels, type Level, type LevelTier } from '@kapital/content';
import { money } from './format.js';

export const TIERS: { id: LevelTier; title: string }[] = [
  { id: 'novice', title: 'Новичок' },
  { id: 'amateur', title: 'Любитель' },
  { id: 'pro', title: 'Профи' },
  { id: 'expert', title: 'Эксперт' },
  { id: 'investor', title: 'Инвестор' },
];

const KEY = 'kapital:campaign';

/** Лучший результат по каждому пройденному уровню, в звёздах. */
export function loadProgress(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveStars(levelId: string, stars: number) {
  const progress = loadProgress();
  if ((progress[levelId] ?? 0) >= stars) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...progress, [levelId]: stars }));
  } catch {
    // прогресс проживёт до перезагрузки
  }
}

/** Уровень открыт, если пройден предыдущий. */
export function isOpen(level: Level, progress: Record<string, number>): boolean {
  const i = levels.indexOf(level);
  return i === 0 || (progress[levels[i - 1]!.id] ?? 0) > 0;
}

export function nextLevel(id: string): Level | null {
  const i = levels.findIndex((l) => l.id === id);
  return levels[i + 1] ?? null;
}

export function goalText(level: Level): string {
  const g = level.goal;
  const goal = g.kind === 'passive' ? `пассивный доход ${money(g.amount)}`
    : g.kind === 'cover' ? `пассивный доход покрывает ${Math.round(g.share * 100)}% расходов`
    : g.kind === 'cash' ? `${money(g.amount)} наличными`
    : g.kind === 'escape' ? 'выход из «Круга забот»'
    : 'победа: мечта или удвоенный доход';
  return `${goal} за ${level.maxTurns} ходов`;
}
