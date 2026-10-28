import type { Board, OuterBoard, Rules } from './types.js';

/** «Круг забот»: 24 клетки, зарплата на рубежах 0, 6, 12, 18. */
export const board: Board = {
  cells: [
    'opportunity', 'temptation', 'opportunity', 'market', 'opportunity', 'charity',
    'opportunity', 'market', 'everyday', 'opportunity', 'baby', 'opportunity',
    'opportunity', 'everyday', 'market', 'opportunity', 'layoff', 'opportunity',
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
  // главный путь к победе — мечта: её покупают только на своей клетке, и удача броска даёт шанс
  // тому, кто вышел позже. Цель по доходу — запасной путь, и она далеко. По симуляции на четверых
  // первый вышедший выигрывает около 62% партий; когда целью было удвоение дохода, было 75%.
  // С 28 профессиями при цели 4 стало 65%: разброс выхода шире, поэтому цель отодвинута до 5.
  outerGoalMultiplier: 5,
  lawsuitShare: 0.5,
  auditShare: 0.25,
  dreamPriceFactor: 0.4,
  startPassiveShare: 0,
  depositRate: 0.01,
  depositStep: 1000,
  installmentMarkup: 0.25,
};

/**
 * Быстрый режим: каждый начинает с бизнесом, который покрывает треть расходов,
 * а цели второго круга ближе. Доля одинакова для всех профессий, поэтому баланс сохраняется.
 * По симуляции: выход за 11–16 ходов, второй круг в одиночку около 10, на четверых партия около 18 ходов.
 */
export const quickRules: Partial<Rules> = {
  startPassiveShare: 0.33,
  outerGoalMultiplier: 2.5,
  dreamPriceFactor: 0.2,
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
