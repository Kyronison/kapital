import { board, outerBoard, quickRules, rules } from './board.js';
import { dreams, ventures } from './outer.js';
import { bigDeals, market, smallDeals, temptations } from './decks.js';
import { everyday } from './everyday.js';
import { levels } from './levels.js';
import { professions } from './professions.js';
import type { Content, GameMode, Level } from './types.js';

export * from './types.js';
export { levels };
export { board, outerBoard, quickRules, rules, bigDeals, market, smallDeals, temptations, everyday, professions, dreams, ventures };

export const defaultContent: Content = {
  professions,
  board,
  smallDeals,
  bigDeals,
  market,
  temptations,
  everyday,
  outerBoard,
  dreams,
  ventures,
  rules,
};

export function contentFor(mode: GameMode, base: Content = defaultContent): Content {
  return mode === 'quick' ? { ...base, rules: { ...base.rules, ...quickRules } } : base;
}

/** Правила уровня «Тренировки»: режим, его особые правила и лимит ходов. */
export function contentForLevel(level: Level, base: Content = defaultContent): Content {
  const c = contentFor(level.mode, base);
  return { ...c, rules: { ...c.rules, ...level.rules, maxTurns: level.maxTurns } };
}
