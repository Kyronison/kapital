import type { Content, Level } from '@kapital/content';
import { passiveIncome, totalExpenses } from './finance.js';
import type { GameState, PlayerState } from './types.js';

export interface LevelProgress {
  done: boolean;
  /** Насколько цель выполнена, от 0 до 1. */
  share: number;
}

/** Выполнена ли цель уровня. Content — уже с правилами уровня. */
export function levelProgress(content: Content, level: Level, game: GameState | Omit<GameState, 'decks' | 'rng' | 'seed'>, p: PlayerState): LevelProgress {
  const g = level.goal;
  const of = (value: number, target: number) => ({ done: value >= target, share: Math.min(1, Math.max(0, value / target)) });
  switch (g.kind) {
    case 'passive':
      return of(passiveIncome(content, p), g.amount);
    case 'cover':
      return of(passiveIncome(content, p) / Math.max(1, totalExpenses(content, p)), g.share);
    case 'cash':
      return of(p.cash, g.amount);
    case 'escape':
      return p.circle === 'outer' ? { done: true, share: 1 } : of(passiveIncome(content, p), totalExpenses(content, p));
    case 'win':
      return { done: game.winnerId === p.id, share: p.circle === 'outer' ? 0.5 + 0.5 * Math.min(1, p.outerIncome / (content.rules.outerGoalMultiplier * p.startOuterIncome)) : 0.5 * Math.min(1, passiveIncome(content, p) / totalExpenses(content, p)) };
  }
}

/** Звёзды за пройденный уровень: чем быстрее, тем больше. */
export function levelStars(level: Level, turns: number): 1 | 2 | 3 {
  return turns <= level.stars[0] ? 3 : turns <= level.stars[1] ? 2 : 1;
}
