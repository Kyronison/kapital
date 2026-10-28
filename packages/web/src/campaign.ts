import { chapters, levels, type Level, type LevelTier } from '@kapital/content';
import { money } from './format.js';

export const TIERS: { id: LevelTier; title: string }[] = [
  { id: 'novice', title: 'Новичок' },
  { id: 'amateur', title: 'Любитель' },
  { id: 'pro', title: 'Профи' },
  { id: 'expert', title: 'Эксперт' },
  { id: 'investor', title: 'Инвестор' },
];

/** Номер части «Тренировки», с нуля. */
export const chapterOf = (level: Level) => chapters.findIndex((c) => c.levels.includes(level));

/** Уровень открыт, если пройден предыдущий в его части. Первый уровень каждой части открыт сразу. */
export function isOpen(level: Level, progress: Record<string, number>): boolean {
  const own = chapters[chapterOf(level)]!.levels;
  const i = own.indexOf(level);
  return i === 0 || (progress[own[i - 1]!.id] ?? 0) > 0;
}

export function nextLevel(id: string): Level | null {
  const i = levels.findIndex((l) => l.id === id);
  return levels[i + 1] ?? null;
}

export function goalText(level: Level): string {
  const g = level.goal;
  const goal = g.kind === 'passive' ? `пассивный доход ${money(g.amount)}`
    : g.kind === 'cover' ? `пассивный доход покрывает ${Math.round(g.share * 100)}% расходов`
    : g.kind === 'cash' ? `${money(g.amount)} своих денег (без долга)`
    : g.kind === 'escape' ? 'выход из «Круга забот»'
    : 'победа: купить мечту';
  return `${goal} за ${level.maxTurns} ходов`;
}

/** Уровень, с которого продолжать: первый открытый и не пройденный, по порядку частей. */
export function currentLevel(progress: Record<string, number>): Level {
  return levels.find((l) => isOpen(l, progress) && !progress[l.id]) ?? levels.at(-1)!;
}
