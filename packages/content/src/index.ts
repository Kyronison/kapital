import { board, rules } from './board.js';
import { bigDeals, market, smallDeals, temptations } from './decks.js';
import { professions } from './professions.js';
import type { Content } from './types.js';

export * from './types.js';
export { board, rules, bigDeals, market, smallDeals, temptations, professions };

export const defaultContent: Content = {
  professions,
  board,
  smallDeals,
  bigDeals,
  market,
  temptations,
  rules,
};
