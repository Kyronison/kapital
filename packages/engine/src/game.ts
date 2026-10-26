import type { Content, DealCard, MarketCard, TemptationCard } from '@kapital/content';
import {
  availableLoan, hasEscaped, passiveIncome, professionOf, roundUpToStep, totalExpenses,
} from './finance.js';
import { Rng } from './rng.js';
import type {
  Action, ActionResult, DeckName, GameEvent, GameState, PlayerSetup, PlayerState,
} from './types.js';

export const MAX_PLAYERS = 6;

export function createGame(content: Content, setups: PlayerSetup[], seed: number): GameState {
  if (setups.length < 1 || setups.length > MAX_PLAYERS) {
    throw new Error(`В партии должно быть от 1 до ${MAX_PLAYERS} игроков`);
  }
  if (new Set(setups.map((s) => s.id)).size !== setups.length) {
    throw new Error('Идентификаторы игроков должны быть уникальными');
  }
  const rng = new Rng(seed >>> 0);
  const deck = (cards: { id: string }[]) => ({ order: rng.shuffle(cards.map((c) => c.id)), pos: 0 });

  const players: PlayerState[] = setups.map((s) => {
    const prof = content.professions.find((p) => p.id === s.professionId);
    if (!prof) throw new Error(`Неизвестная профессия: ${s.professionId}`);
    return {
      id: s.id,
      name: s.name,
      professionId: s.professionId,
      cash: prof.startCash,
      children: 0,
      bankLoan: 0,
      assets: [],
      stocks: [],
      position: 0,
      layoffPaydays: 0,
      charityTurns: 0,
      turnsTaken: 0,
      escapedAtTurn: null,
      bankruptcies: 0,
    };
  });

  return {
    seed: seed >>> 0,
    rng: rng.state,
    status: 'playing',
    players,
    current: 0,
    phase: 'roll',
    lastRoll: null,
    pending: null,
    pendingResolved: false,
    decks: {
      smallDeals: deck(content.smallDeals),
      bigDeals: deck(content.bigDeals),
      market: deck(content.market),
      temptations: deck(content.temptations),
    },
    nextAssetId: 1,
  };
}

class Turn {
  readonly events: GameEvent[] = [];
  readonly rng: Rng;

  constructor(readonly content: Content, readonly s: GameState) {
    this.rng = new Rng(s.rng);
  }

  get current(): PlayerState {
    return this.s.players[this.s.current]!;
  }

  draw<T extends DealCard | MarketCard | TemptationCard>(deck: DeckName): T {
    const d = this.s.decks[deck];
    if (d.pos >= d.order.length) {
      d.order = this.rng.shuffle(d.order);
      d.pos = 0;
    }
    const id = d.order[d.pos++]!;
    const card = (this.content[deck] as { id: string }[]).find((c) => c.id === id);
    if (!card) throw new Error(`Карта ${id} не найдена в колоде ${deck}`);
    this.events.push({ type: 'card_drawn', playerId: this.current.id, deck, cardId: id });
    return card as T;
  }

  pay(p: PlayerState, amount: number, reason: string) {
    p.cash -= amount;
    this.events.push({ type: 'paid', playerId: p.id, amount, reason });
    this.settle(p);
  }

  payday(p: PlayerState) {
    const salaryPaid = p.layoffPaydays === 0;
    if (!salaryPaid) p.layoffPaydays--;
    const salary = salaryPaid ? professionOf(this.content, p).salary : 0;
    const amount = salary + passiveIncome(p) - totalExpenses(this.content, p);
    p.cash += amount;
    this.events.push({ type: 'payday', playerId: p.id, amount, salaryPaid });
    this.settle(p);
  }

  /** Закрывает отрицательный баланс: кредит в пределах лимита, распродажа активов, банкротство. */
  settle(p: PlayerState) {
    const { loanStep } = this.content.rules;
    while (p.cash < 0) {
      const need = roundUpToStep(-p.cash, loanStep);
      const loan = Math.min(need, availableLoan(this.content, p));
      if (loan > 0) {
        p.bankLoan += loan;
        p.cash += loan;
        this.events.push({ type: 'loan_taken', playerId: p.id, amount: loan, forced: true });
        continue;
      }
      const stock = p.stocks[0];
      if (stock) {
        const proceeds = Math.floor((stock.shares * stock.avgPrice) / 2);
        p.stocks.shift();
        p.cash += proceeds;
        this.events.push({ type: 'asset_liquidated', playerId: p.id, assetId: stock.ticker, proceeds });
        continue;
      }
      // сначала продаём наименее доходный актив за половину взноса
      const asset = [...p.assets].sort((a, b) => a.flow - b.flow)[0];
      if (asset) {
        const proceeds = Math.floor(asset.down / 2);
        p.assets = p.assets.filter((a) => a.id !== asset.id);
        p.cash += proceeds;
        this.events.push({ type: 'asset_liquidated', playerId: p.id, assetId: asset.id, proceeds });
        continue;
      }
      const prof = professionOf(this.content, p);
      p.cash = prof.startCash;
      p.bankLoan = 0;
      p.layoffPaydays = 0;
      p.bankruptcies++;
      this.events.push({ type: 'bankrupt', playerId: p.id });
    }
  }

  land(p: PlayerState) {
    const cell = this.content.board.cells[p.position]!;
    this.events.push({ type: 'landed', playerId: p.id, cell });
    const { rules } = this.content;
    switch (cell) {
      case 'opportunity':
        this.s.phase = 'choose_deal';
        return;
      case 'market': {
        const card = this.draw<MarketCard>('market');
        this.s.pending = { deck: 'market', card };
        if (card.kind === 'offer') {
          this.s.phase = 'market';
          return;
        }
        if (p.assets.some((a) => card.assetTypes.includes(a.assetType))) {
          this.pay(p, card.amount, card.title);
        }
        this.s.phase = 'end';
        return;
      }
      case 'temptation': {
        const card = this.draw<TemptationCard>('temptations');
        this.s.pending = { deck: 'temptations', card };
        this.pay(p, card.amount, card.title);
        this.s.phase = 'end';
        return;
      }
      case 'charity':
        this.s.phase = 'charity';
        return;
      case 'baby':
        if (p.children < rules.maxChildren) {
          p.children++;
          this.events.push({ type: 'child_born', playerId: p.id, children: p.children });
        }
        this.s.phase = 'end';
        return;
      case 'layoff':
        p.layoffPaydays = rules.layoffPaydays;
        this.events.push({ type: 'laid_off', playerId: p.id });
        this.s.phase = 'end';
        return;
    }
  }

  advanceTurn() {
    const { maxTurns } = this.content.rules;
    for (const p of this.s.players) {
      if (p.escapedAtTurn === null && hasEscaped(this.content, p)) {
        p.escapedAtTurn = p.turnsTaken;
        this.events.push({ type: 'escaped', playerId: p.id, turn: p.turnsTaken });
      }
    }
    this.s.pending = null;
    this.s.pendingResolved = false;
    this.s.lastRoll = null;
    const n = this.s.players.length;
    for (let step = 1; step <= n; step++) {
      const idx = (this.s.current + step) % n;
      const p = this.s.players[idx]!;
      if (p.escapedAtTurn === null && p.turnsTaken < maxTurns) {
        this.s.current = idx;
        this.s.phase = 'roll';
        this.events.push({ type: 'turn_started', playerId: p.id });
        return;
      }
    }
    this.s.status = 'finished';
    this.events.push({ type: 'game_finished' });
  }
}

const fail = (error: string): ActionResult => ({ ok: false, error });

/** Единственная точка изменения состояния. Не мутирует входной state. */
export function applyAction(content: Content, state: GameState, action: Action): ActionResult {
  if (state.status !== 'playing') return fail('Партия завершена');
  const s = structuredClone(state);
  const t = new Turn(content, s);
  const p = s.players.find((x) => x.id === action.playerId);
  if (!p) return fail('Игрок не найден');
  const isCurrent = t.current.id === p.id;
  const { rules } = content;

  switch (action.type) {
    case 'ROLL': {
      if (!isCurrent || s.phase !== 'roll') return fail('Сейчас нельзя бросать кубик');
      const dice = action.dice ?? (p.charityTurns > 0 ? 2 : 1);
      if (dice === 2 && p.charityTurns === 0) return fail('Два кубика доступны только после «Помощи»');
      if (p.charityTurns > 0) p.charityTurns--;
      const roll = Array.from({ length: dice }, () => t.rng.int(1, 6));
      const total = roll.reduce((a, b) => a + b, 0);
      s.lastRoll = roll;
      p.turnsTaken++;
      const n = content.board.cells.length;
      for (let i = 0; i < total; i++) {
        p.position = (p.position + 1) % n;
        if (content.board.paydayAt.includes(p.position)) t.payday(p);
      }
      t.events.push({ type: 'rolled', playerId: p.id, dice: roll, to: p.position });
      t.land(p);
      break;
    }

    case 'CHOOSE_DEAL': {
      if (!isCurrent || s.phase !== 'choose_deal') return fail('Сейчас нельзя выбрать сделку');
      const deck = action.size === 'small' ? 'smallDeals' : 'bigDeals';
      s.pending = { deck, card: t.draw<DealCard>(deck) };
      s.phase = 'deal';
      break;
    }

    case 'BUY': {
      if (!isCurrent || s.phase !== 'deal' || !s.pending || s.pendingResolved) return fail('Сейчас нечего покупать');
      if (s.pending.deck !== 'smallDeals' && s.pending.deck !== 'bigDeals') return fail('Сейчас нечего покупать');
      const card = s.pending.card;
      if (card.kind === 'asset') {
        if (p.cash < card.down) return fail('Не хватает денег на взнос: возьмите кредит или откажитесь');
        p.cash -= card.down;
        p.assets.push({
          id: `a${s.nextAssetId++}`,
          cardId: card.id,
          assetType: card.assetType,
          title: card.title,
          cost: card.cost,
          down: card.down,
          mortgage: card.cost - card.down,
          flow: card.flow,
        });
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price: card.down });
        s.phase = 'end';
      } else {
        const shares = action.shares ?? 0;
        if (!Number.isInteger(shares) || shares <= 0) return fail('Укажите целое число акций');
        const price = shares * card.price;
        if (p.cash < price) return fail('Не хватает денег на акции');
        p.cash -= price;
        const h = p.stocks.find((x) => x.ticker === card.ticker);
        if (h) {
          h.avgPrice = (h.avgPrice * h.shares + price) / (h.shares + shares);
          h.shares += shares;
        } else {
          p.stocks.push({ ticker: card.ticker, shares, avgPrice: card.price });
        }
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price });
        // карта остаётся открытой: другие игроки ещё могут продать по этой цене
        s.pendingResolved = true;
      }
      break;
    }

    case 'SELL_STOCK': {
      if (s.phase !== 'deal' || s.pending?.deck !== 'smallDeals' || s.pending.card.kind !== 'stock') {
        return fail('Сейчас нельзя продать акции');
      }
      const card = s.pending.card;
      const h = p.stocks.find((x) => x.ticker === card.ticker);
      if (!Number.isInteger(action.shares) || action.shares <= 0 || !h || h.shares < action.shares) {
        return fail('Столько акций нет');
      }
      h.shares -= action.shares;
      if (h.shares === 0) p.stocks = p.stocks.filter((x) => x !== h);
      const proceeds = action.shares * card.price;
      p.cash += proceeds;
      t.events.push({ type: 'sold', playerId: p.id, what: card.ticker, proceeds });
      break;
    }

    case 'SELL_ASSET': {
      if (s.phase !== 'market' || s.pending?.deck !== 'market' || s.pending.card.kind !== 'offer') {
        return fail('Сейчас нет покупателя');
      }
      const offer = s.pending.card;
      const asset = p.assets.find((a) => a.id === action.assetId);
      if (!asset || asset.assetType !== offer.assetType) return fail('Этот актив покупателю не нужен');
      p.assets = p.assets.filter((a) => a !== asset);
      const proceeds = Math.round(asset.cost * offer.multiplier) - asset.mortgage;
      p.cash += proceeds;
      t.events.push({ type: 'sold', playerId: p.id, what: asset.id, proceeds });
      t.settle(p);
      break;
    }

    case 'DONATE': {
      if (!isCurrent || s.phase !== 'charity') return fail('Сейчас нельзя пожертвовать');
      const amount = Math.round(rules.charityShare * (professionOf(content, p).salary + passiveIncome(p)));
      if (p.cash < amount) return fail('Не хватает денег на пожертвование');
      p.cash -= amount;
      p.charityTurns = rules.charityTurns;
      t.events.push({ type: 'donated', playerId: p.id, amount });
      s.phase = 'end';
      break;
    }

    case 'TAKE_LOAN': {
      if (!isCurrent) return fail('Кредит берут только в свой ход');
      const { amount } = action;
      if (!Number.isInteger(amount) || amount <= 0 || amount % rules.loanStep !== 0) {
        return fail(`Сумма кредита кратна ${rules.loanStep}`);
      }
      if (amount > availableLoan(content, p)) return fail('Банк не даст столько: превышен лимит');
      p.bankLoan += amount;
      p.cash += amount;
      t.events.push({ type: 'loan_taken', playerId: p.id, amount, forced: false });
      break;
    }

    case 'REPAY_LOAN': {
      if (!isCurrent) return fail('Кредит гасят только в свой ход');
      const { amount } = action;
      if (!Number.isInteger(amount) || amount <= 0 || amount % rules.loanStep !== 0) {
        return fail(`Сумма погашения кратна ${rules.loanStep}`);
      }
      if (amount > p.bankLoan) return fail('Долг меньше этой суммы');
      if (amount > p.cash) return fail('Не хватает денег');
      p.bankLoan -= amount;
      p.cash -= amount;
      t.events.push({ type: 'loan_repaid', playerId: p.id, amount });
      break;
    }

    case 'END_TURN': {
      if (!isCurrent || s.phase === 'roll') return fail('Сначала бросьте кубик');
      t.advanceTurn();
      break;
    }

    default:
      return fail('Неизвестное действие');
  }

  s.rng = t.rng.state;
  return { ok: true, state: s, events: t.events };
}

