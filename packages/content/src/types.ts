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
  | 'layoff';

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
}

export type DealCard = AssetCard | StockCard;

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
}

export interface Content {
  professions: Profession[];
  board: Board;
  smallDeals: DealCard[];
  bigDeals: DealCard[];
  market: MarketCard[];
  temptations: TemptationCard[];
  rules: Rules;
}
