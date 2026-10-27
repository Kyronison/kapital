import type {
  AssetType, Content, DealCard, EverydayCard, MarketCard, Risk, TemptationCard, VentureCard,
} from '@kapital/content';

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

export interface Policy {
  risk: Risk;
  /** Взнос за период, зафиксирован при покупке. */
  premium: number;
}

export interface Subscription {
  cardId: string;
  title: string;
  amount: number;
  /** Сколько зарплат ещё будет списываться. */
  paydaysLeft: number;
}

export interface BondHolding {
  id: string;
  cardId: string;
  title: string;
  count: number;
  /** Номинал одной облигации и купон одной облигации за период. */
  price: number;
  coupon: number;
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
  policies: Policy[];
  subscriptions: Subscription[];
  /** На сколько тренинги снизили прочие расходы за период. */
  savings: number;
  /** Сумма на банковском вкладе. */
  deposit: number;
  bonds: BondHolding[];
}

export type Phase =
  | 'roll'
  | 'choose_deal'
  | 'deal'
  | 'market'
  | 'charity'
  | 'dream'
  | 'end';

export type DeckName = 'smallDeals' | 'bigDeals' | 'market' | 'temptations' | 'everyday' | 'ventures';

export interface DeckState {
  order: string[];
  pos: number;
}

export type PendingCard =
  | { deck: 'smallDeals' | 'bigDeals'; card: DealCard }
  | { deck: 'market'; card: MarketCard }
  | { deck: 'temptations'; card: TemptationCard }
  | { deck: 'everyday'; card: EverydayCard }
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
  | { type: 'DEPOSIT'; playerId: PlayerId; amount: number }
  | { type: 'WITHDRAW'; playerId: PlayerId; amount: number }
  | { type: 'SELL_BOND'; playerId: PlayerId; bondId: string }
  | { type: 'CANCEL_POLICY'; playerId: PlayerId; risk: Risk }
  | { type: 'END_TURN'; playerId: PlayerId };

export type GameEvent =
  | { type: 'rolled'; playerId: PlayerId; dice: number[]; to: number }
  | { type: 'payday'; playerId: PlayerId; amount: number; salaryPaid: boolean }
  | { type: 'landed'; playerId: PlayerId; cell: string }
  | { type: 'card_drawn'; playerId: PlayerId; deck: DeckName; cardId: string }
  | { type: 'bought'; playerId: PlayerId; cardId: string; price: number }
  | { type: 'venture_rolled'; playerId: PlayerId; cardId: string; roll: number; success: boolean }
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
  | { type: 'covered'; playerId: PlayerId; risk: Risk; amount: number }
  | { type: 'insured'; playerId: PlayerId; risk: Risk; premium: number }
  | { type: 'policy_cancelled'; playerId: PlayerId; risk: Risk }
  | { type: 'subscribed'; playerId: PlayerId; title: string; amount: number; paydays: number }
  | { type: 'trained'; playerId: PlayerId; cost: number; saving: number }
  | { type: 'received'; playerId: PlayerId; amount: number; reason: string }
  | { type: 'deposited'; playerId: PlayerId; amount: number }
  | { type: 'withdrawn'; playerId: PlayerId; amount: number; forced: boolean }
  | { type: 'bond_sold'; playerId: PlayerId; bondId: string; proceeds: number }
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
