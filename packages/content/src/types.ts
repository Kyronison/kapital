/** Все суммы — в капах (К), условной игровой валюте. */

export interface Profession {
  id: string;
  title: string;
  salary: number;
  /** Регулярные расходы за период, по статьям. */
  expenses: {
    taxes: number;
    housing: number;
    car: number;
    loans: number;
    other: number;
  };
  perChild: number;
  startCash: number;
  /** Долги, которые числятся в пассивах (ипотека, автокредит, карты). */
  liabilities: { title: string; amount: number }[];
}

export type CellKind =
  | 'opportunity'
  | 'market'
  | 'temptation'
  | 'charity'
  | 'baby'
  | 'layoff'
  | 'everyday';

export interface Board {
  cells: CellKind[];
  /** Индексы клеток, при прохождении или попадании на которые начисляется зарплата. */
  paydayAt: number[];
}

export type AssetType =
  | 'studio'
  | 'room'
  | 'garage'
  | 'vending'
  | 'fourplex'
  | 'carwash'
  | 'cafe'
  | 'complex';

export const REAL_ESTATE: readonly AssetType[] = ['studio', 'room', 'garage', 'fourplex', 'complex'];

export interface AssetCard {
  id: string;
  kind: 'asset';
  assetType: AssetType;
  title: string;
  cost: number;
  down: number;
  flow: number;
}

export interface StockCard {
  id: string;
  kind: 'stock';
  ticker: string;
  title: string;
  price: number;
  /** Самая низкая и самая высокая цена этой акции в колоде: подсказка, дорого или дёшево. */
  low: number;
  high: number;
}

/** Облигации: доход ниже, чем у бизнеса, зато их можно в любой свой ход вернуть по номиналу. */
export interface BondCard {
  id: string;
  kind: 'bond';
  title: string;
  /** Номинал одной облигации. */
  price: number;
  /** Купон одной облигации за период. */
  coupon: number;
}

export type DealCard = AssetCard | StockCard | BondCard;

export interface OfferCard {
  id: string;
  kind: 'offer';
  assetType: AssetType;
  title: string;
  /** Цена выкупа как доля от стоимости актива. */
  multiplier: number;
}

export interface ExpenseCard {
  id: string;
  kind: 'expense';
  /** Платит текущий игрок, если владеет хотя бы одним активом этих типов. */
  assetTypes: AssetType[];
  title: string;
  amount: number;
}

export type MarketCard = OfferCard | ExpenseCard;

export interface TemptationCard {
  id: string;
  title: string;
  amount: number;
}

export type Risk = 'health' | 'property';

/**
 * Карта «Будней». Суммы заданы долями зарплаты: так событие одинаково ощутимо для любой профессии.
 * - spend: разовая трата;
 * - monthly: подписка, которая добавляется к расходам на несколько зарплат;
 * - trouble: неприятность, от которой защищает полис;
 * - insurance: предложение полиса с ежемесячным взносом;
 * - training: обучение, которое навсегда снижает прочие расходы;
 * - windfall: неожиданный приход денег.
 */
export type EverydayCard =
  | { id: string; kind: 'spend'; title: string; share: number }
  | { id: string; kind: 'monthly'; title: string; share: number; paydays: number }
  | { id: string; kind: 'trouble'; title: string; share: number; risk: Risk }
  | { id: string; kind: 'insurance'; title: string; share: number; risk: Risk }
  | { id: string; kind: 'training'; title: string; share: number; saving: number }
  | { id: string; kind: 'windfall'; title: string; share: number };

export type OuterCellKind = 'venture' | 'dream' | 'lawsuit' | 'audit' | 'crisis' | 'charity';

export interface OuterBoard {
  cells: OuterCellKind[];
  /** Рубежи, на которых начисляется доход «Свободного пути». */
  paydayAt: number[];
  /** Какие мечты можно купить на клетке-мечте, по индексу клетки. */
  dreamsAt: Record<number, string[]>;
}

export interface Dream {
  id: string;
  title: string;
  /** Цена в стартовых доходах «Свободного пути»: так мечта одинаково далека для любой профессии. */
  priceInIncomes: number;
}

/** Инвестиция продаётся долями: игрок покупает столько долей, сколько хочет и может оплатить. */
export interface VentureCard {
  id: string;
  title: string;
  /** Цена одной доли. */
  cost: number;
  /** Доход одной доли за период. */
  income: number;
}

export interface Rules {
  loanStep: number;
  /** Платёж по банковскому кредиту за период, доля от суммы долга. */
  loanRate: number;
  /** Платежи по кредиту не больше этой доли положительного потока. */
  loanCapShare: number;
  maxChildren: number;
  layoffPaydays: number;
  charityShare: number;
  charityTurns: number;
  /** Сколько своих ходов может сделать игрок, прежде чем партия завершится. */
  maxTurns: number;
  /** Стартовый доход «Свободного пути» = пассивный доход при выходе × этот множитель. */
  outerIncomeMultiplier: number;
  /** Победа, когда доход «Свободного пути» вырос во столько раз от стартового. */
  outerGoalMultiplier: number;
  lawsuitShare: number;
  auditShare: number;
  /** Множитель цены мечты: меньше 1 в быстром режиме. */
  dreamPriceFactor: number;
  /** Доля расходов, которую с самого начала покрывает стартовый бизнес. 0 — без него. */
  startPassiveShare: number;
  /** Доход банковского вклада за период, доля от суммы. */
  depositRate: number;
  /** Вклад открывается и пополняется суммами, кратными этому шагу. */
  depositStep: number;
}

export type GameMode = 'classic' | 'quick';

export interface Content {
  professions: Profession[];
  board: Board;
  smallDeals: DealCard[];
  bigDeals: DealCard[];
  market: MarketCard[];
  temptations: TemptationCard[];
  everyday: EverydayCard[];
  outerBoard: OuterBoard;
  dreams: Dream[];
  ventures: VentureCard[];
  rules: Rules;
}

export type LevelTier = 'novice' | 'amateur' | 'pro' | 'expert' | 'investor';

/** Цель уровня «Тренировки». */
export type LevelGoal =
  | { kind: 'passive'; amount: number }
  | { kind: 'cover'; share: number }
  | { kind: 'cash'; amount: number }
  | { kind: 'escape' }
  | { kind: 'win' };

export interface Level {
  id: string;
  tier: LevelTier;
  title: string;
  /** Что нужно сделать и в чём урок. */
  brief: string;
  professionId: string;
  dreamId: string;
  mode: GameMode;
  /** Изменения правил на этом уровне. */
  rules?: Partial<Rules>;
  goal: LevelGoal;
  maxTurns: number;
  /** За сколько ходов три и две звезды; дольше — одна. */
  stars: [number, number];
}
