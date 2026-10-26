import type { AssetType, Content, DealCard, MarketCard, TemptationCard, VentureCard } from '@kapital/content';

export type PlayerId = string;

export interface OwnedAsset {
  /** Уникален в пределах партии. */
  id: string;
  cardId: string;
  assetType: AssetType;
  title: string;
  cost: number;
  down: number;
  mortgage: number;
  flow: number;
}

export interface StockHolding {
  ticker: string;
  shares: number;
  avgPrice: number;
}

export interface OwnedVenture {
  id: string;
  cardId: string;
  title: string;
  shares: number;
  /** Цена и доход всех долей вместе. */
  cost: number;
  income: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  professionId: string;
  dreamId: string;
  circle: 'inner' | 'outer';
  cash: number;
  children: number;
  bankLoan: number;
  assets: OwnedAsset[];
  stocks: StockHolding[];
  position: number;
  /** Сколько следующих зарплат не придёт после «Сокращения». */
  layoffPaydays: number;
  /** Сколько ходов ещё можно бросать два кубика после «Помощи». */
  charityTurns: number;
  turnsTaken: number;
  /** Номер своего хода, на котором игрок вышел из «Круга забот». */
  escapedAtTurn: number | null;
  bankruptcies: number;
  /** Доход «Свободного пути» за период: стартовый плюс купленные инвестиции. */
  outerIncome: number;
  startOuterIncome: number;
  ventures: OwnedVenture[];
  /** Сколько следующих доходов «Свободного пути» пропадёт после «Кризиса». */
  skipIncome: number;
  wonAtTurn: number | null;
}

export type Phase =
  | 'roll'
  | 'choose_deal'
  | 'deal'
  | 'market'
  | 'charity'
  | 'dream'
  | 'end';

export type DeckName = 'smallDeals' | 'bigDeals' | 'market' | 'temptations' | 'ventures';

export interface DeckState {
  order: string[];
  pos: number;
}

export type PendingCard =
  | { deck: 'smallDeals' | 'bigDeals'; card: DealCard }
  | { deck: 'market'; card: MarketCard }
  | { deck: 'temptations'; card: TemptationCard }
  | { deck: 'ventures'; card: VentureCard };

export interface GameState {
  seed: number;
  rng: number;
  status: 'playing' | 'finished';
  winnerId: PlayerId | null;
  players: PlayerState[];
  current: number;
  phase: Phase;
  lastRoll: number[] | null;
  pending: PendingCard | null;
  /** Текущий игрок уже купил акции с открытой карты. */
  pendingResolved: boolean;
  decks: Record<DeckName, DeckState>;
  nextAssetId: number;
}

export type Action =
  | { type: 'ROLL'; playerId: PlayerId; dice?: 1 | 2 }
  | { type: 'CHOOSE_DEAL'; playerId: PlayerId; size: 'small' | 'big' }
  | { type: 'BUY'; playerId: PlayerId; shares?: number }
  | { type: 'SELL_STOCK'; playerId: PlayerId; shares: number }
  | { type: 'SELL_ASSET'; playerId: PlayerId; assetId: string }
  | { type: 'DONATE'; playerId: PlayerId }
  | { type: 'BUY_DREAM'; playerId: PlayerId }
  | { type: 'TAKE_LOAN'; playerId: PlayerId; amount: number }
  | { type: 'REPAY_LOAN'; playerId: PlayerId; amount: number }
  | { type: 'END_TURN'; playerId: PlayerId };

export type GameEvent =
  | { type: 'rolled'; playerId: PlayerId; dice: number[]; to: number }
  | { type: 'payday'; playerId: PlayerId; amount: number; salaryPaid: boolean }
  | { type: 'landed'; playerId: PlayerId; cell: string }
  | { type: 'card_drawn'; playerId: PlayerId; deck: DeckName; cardId: string }
  | { type: 'bought'; playerId: PlayerId; cardId: string; price: number }
  | { type: 'sold'; playerId: PlayerId; what: string; proceeds: number }
  | { type: 'paid'; playerId: PlayerId; amount: number; reason: string }
  | { type: 'loan_taken'; playerId: PlayerId; amount: number; forced: boolean }
  | { type: 'loan_repaid'; playerId: PlayerId; amount: number }
  | { type: 'child_born'; playerId: PlayerId; children: number }
  | { type: 'laid_off'; playerId: PlayerId }
  | { type: 'donated'; playerId: PlayerId; amount: number }
  | { type: 'asset_liquidated'; playerId: PlayerId; assetId: string; proceeds: number }
  | { type: 'bankrupt'; playerId: PlayerId }
  | { type: 'escaped'; playerId: PlayerId; turn: number; outerIncome: number }
  | { type: 'income'; playerId: PlayerId; amount: number }
  | { type: 'income_lost'; playerId: PlayerId }
  | { type: 'crisis'; playerId: PlayerId }
  | { type: 'won'; playerId: PlayerId; turn: number; by: 'dream' | 'income' }
  | { type: 'turn_started'; playerId: PlayerId }
  | { type: 'game_finished' };

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };

export interface PlayerSetup {
  id: PlayerId;
  name: string;
  professionId: string;
  /** Если не задана, берётся мечта по порядку игрока. */
  dreamId?: string;
}

export interface Ctx {
  content: Content;
}
