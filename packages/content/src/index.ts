import { board, outerBoard, quickRules, rules } from './board.js';
import { dreams, ventures } from './outer.js';
import { bigDeals, market, smallDeals, temptations } from './decks.js';
import { everyday } from './everyday.js';
import { professions } from './professions.js';
import type { Content, GameMode } from './types.js';

export * from './types.js';
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
