import { board, outerBoard, rules } from './board.js';
import { dreams, ventures } from './outer.js';
import { bigDeals, market, smallDeals, temptations } from './decks.js';
import { professions } from './professions.js';
import type { Content } from './types.js';

export * from './types.js';
export { board, outerBoard, rules, bigDeals, market, smallDeals, temptations, professions, dreams, ventures };

export const defaultContent: Content = {
  professions,
  board,
  smallDeals,
  bigDeals,
  market,
  temptations,
  outerBoard,
  dreams,
  ventures,
  rules,
};
