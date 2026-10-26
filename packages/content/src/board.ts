import type { Board, OuterBoard, Rules } from './types.js';

/** «Круг забот»: 24 клетки, зарплата на рубежах 0, 6, 12, 18. */
export const board: Board = {
  cells: [
    'opportunity', 'temptation', 'opportunity', 'market', 'opportunity', 'charity',
    'opportunity', 'market', 'everyday', 'opportunity', 'baby', 'opportunity',
    'opportunity', 'temptation', 'market', 'opportunity', 'layoff', 'opportunity',
    'opportunity', 'everyday', 'market', 'opportunity', 'opportunity', 'opportunity',
  ],
  paydayAt: [0, 6, 12, 18],
};

export const rules: Rules = {
  loanStep: 1000,
  loanRate: 0.06,
  loanCapShare: 0.5,
  maxChildren: 3,
  layoffPaydays: 2,
  charityShare: 0.1,
  charityTurns: 3,
  maxTurns: 120,
  outerIncomeMultiplier: 10,
  outerGoalMultiplier: 2,
  lawsuitShare: 0.5,
  auditShare: 0.25,
  dreamPriceFactor: 1,
  startPassiveShare: 0,
};

/**
 * Быстрый режим: каждый начинает с бизнесом, который покрывает треть расходов,
 * а цели второго круга ближе. Доля одинакова для всех профессий, поэтому баланс сохраняется.
 * По симуляции: выход за 11–16 ходов, второй круг за 6–7, вся партия около 20 ходов.
 */
export const quickRules: Partial<Rules> = {
  startPassiveShare: 0.33,
  outerGoalMultiplier: 1.3,
  dreamPriceFactor: 0.35,
  maxTurns: 40,
};

/** «Свободный путь»: 16 клеток, доход на рубежах 0, 4, 8, 12. */
export const outerBoard: OuterBoard = {
  cells: [
    'venture', 'dream', 'venture', 'lawsuit', 'venture', 'charity', 'dream', 'venture',
    'audit', 'venture', 'dream', 'crisis', 'venture', 'charity', 'dream', 'audit',
  ],
  paydayAt: [0, 4, 8, 12],
  dreamsAt: {
    1: ['sea-house', 'world-trip'],
    6: ['own-school', 'yacht'],
    10: ['vineyard', 'foundation'],
    14: ['space-flight', 'film-studio'],
  },
};
