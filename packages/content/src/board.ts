import type { Board, Rules } from './types.js';

/** «Круг забот»: 24 клетки, зарплата на рубежах 0, 6, 12, 18. */
export const board: Board = {
  cells: [
    'opportunity', 'temptation', 'opportunity', 'market', 'opportunity', 'charity',
    'opportunity', 'market', 'temptation', 'opportunity', 'baby', 'opportunity',
    'opportunity', 'temptation', 'market', 'opportunity', 'layoff', 'opportunity',
    'opportunity', 'temptation', 'market', 'opportunity', 'opportunity', 'opportunity',
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
};
