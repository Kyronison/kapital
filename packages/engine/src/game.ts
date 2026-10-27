import type { Content, DealCard, EverydayCard, MarketCard, TemptationCard, VentureCard } from '@kapital/content';
import {
  availableLoan, baseExpenses, everydayAmount, hasEscaped, passiveIncome, professionOf, roundUpToStep,
  totalExpenses, trainingSaving,
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

  const players: PlayerState[] = setups.map((s, i) => {
    const prof = content.professions.find((p) => p.id === s.professionId);
    if (!prof) throw new Error(`Неизвестная профессия: ${s.professionId}`);
    const dreamId = s.dreamId ?? content.dreams[i % content.dreams.length]!.id;
    if (!content.dreams.some((d) => d.id === dreamId)) throw new Error(`Неизвестная мечта: ${dreamId}`);
    return {
      id: s.id,
      name: s.name,
      professionId: s.professionId,
      dreamId,
      circle: 'inner',
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
      outerIncome: 0,
      startOuterIncome: 0,
      ventures: [],
      skipIncome: 0,
      wonAtTurn: null,
      policies: [],
      subscriptions: [],
      savings: 0,
      deposit: 0,
      bonds: [],
    };
  });

  let nextAssetId = 1;
  if (content.rules.startPassiveShare > 0) {
    for (const p of players) {
      const flow = Math.round(content.rules.startPassiveShare * baseExpenses(content, p));
      const cost = flow * 10;
      p.assets.push({
        id: `a${nextAssetId++}`, cardId: 'starter', assetType: 'vending', title: 'Стартовый бизнес',
        cost, down: cost, mortgage: 0, flow,
      });
    }
  }

  return {
    seed: seed >>> 0,
    rng: rng.state,
    status: 'playing',
    winnerId: null,
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
      everyday: deck(content.everyday),
      ventures: deck(content.ventures),
    },
    nextAssetId,
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

  draw<T extends DealCard | MarketCard | TemptationCard | EverydayCard | VentureCard>(deck: DeckName): T {
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
    const amount = salary + passiveIncome(this.content, p) - totalExpenses(this.content, p);
    p.cash += amount;
    this.events.push({ type: 'payday', playerId: p.id, amount, salaryPaid });
    for (const sub of p.subscriptions) sub.paydaysLeft--;
    p.subscriptions = p.subscriptions.filter((x) => x.paydaysLeft > 0);
    this.settle(p);
  }

  /** Закрывает отрицательный баланс: кредит в пределах лимита, распродажа активов, банкротство. */
  settle(p: PlayerState) {
    const { loanStep } = this.content.rules;
    while (p.cash < 0) {
      // сначала свои сбережения: вклад, затем облигации по номиналу
      if (p.deposit > 0) {
        const amount = Math.min(p.deposit, roundUpToStep(-p.cash, this.content.rules.depositStep));
        p.deposit -= amount;
        p.cash += amount;
        this.events.push({ type: 'withdrawn', playerId: p.id, amount, forced: true });
        continue;
      }
      const bond = p.bonds[0];
      if (bond) {
        p.bonds.shift();
        const proceeds = bond.count * bond.price;
        p.cash += proceeds;
        this.events.push({ type: 'bond_sold', playerId: p.id, bondId: bond.id, proceeds });
        continue;
      }
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
      p.subscriptions = [];
      p.bankruptcies++;
      this.events.push({ type: 'bankrupt', playerId: p.id });
    }
  }

  outerPayday(p: PlayerState) {
    if (p.skipIncome > 0) {
      p.skipIncome--;
      this.events.push({ type: 'income_lost', playerId: p.id });
      return;
    }
    p.cash += p.outerIncome;
    this.events.push({ type: 'income', playerId: p.id, amount: p.outerIncome });
  }

  landOuter(p: PlayerState) {
    const { rules, outerBoard } = this.content;
    const cell = outerBoard.cells[p.position]!;
    this.events.push({ type: 'landed', playerId: p.id, cell });
    switch (cell) {
      case 'venture':
        this.s.pending = { deck: 'ventures', card: this.draw<VentureCard>('ventures') };
        this.s.phase = 'deal';
        return;
      case 'dream':
        this.s.phase = outerBoard.dreamsAt[p.position]?.includes(p.dreamId) ? 'dream' : 'end';
        return;
      case 'lawsuit':
        this.pay(p, Math.floor(p.cash * rules.lawsuitShare), 'Судебный иск');
        this.s.phase = 'end';
        return;
      case 'audit':
        this.pay(p, Math.floor(p.cash * rules.auditShare), 'Налоговая проверка');
        this.s.phase = 'end';
        return;
      case 'crisis':
        p.skipIncome = 1;
        this.events.push({ type: 'crisis', playerId: p.id });
        this.s.phase = 'end';
        return;
      case 'charity':
        this.s.phase = 'charity';
        return;
    }
  }

  win(p: PlayerState, by: 'dream' | 'income') {
    p.wonAtTurn = p.turnsTaken;
    this.s.winnerId = p.id;
    this.events.push({ type: 'won', playerId: p.id, turn: p.turnsTaken, by });
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
      case 'everyday':
        this.everyday(p);
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

  everyday(p: PlayerState) {
    const card = this.draw<EverydayCard>('everyday');
    this.s.pending = { deck: 'everyday', card };
    this.s.phase = 'end';
    const amount = everydayAmount(this.content, p, card);
    switch (card.kind) {
      case 'spend':
        this.pay(p, amount, card.title);
        return;
      case 'trouble':
        if (p.policies.some((x) => x.risk === card.risk)) {
          this.events.push({ type: 'covered', playerId: p.id, risk: card.risk, amount });
        } else {
          this.pay(p, amount, card.title);
        }
        return;
      case 'monthly':
        p.subscriptions.push({ cardId: card.id, title: card.title, amount, paydaysLeft: card.paydays });
        this.events.push({ type: 'subscribed', playerId: p.id, title: card.title, amount, paydays: card.paydays });
        return;
      case 'windfall':
        p.cash += amount;
        this.events.push({ type: 'received', playerId: p.id, amount, reason: card.title });
        return;
      case 'insurance':
        if (!p.policies.some((x) => x.risk === card.risk)) this.s.phase = 'deal';
        return;
      case 'training':
        this.s.phase = 'deal';
        return;
    }
  }

  advanceTurn() {
    const { maxTurns, outerIncomeMultiplier, outerGoalMultiplier } = this.content.rules;
    for (const p of this.s.players) {
      if (p.circle === 'inner' && hasEscaped(this.content, p)) {
        p.escapedAtTurn = p.turnsTaken;
        p.circle = 'outer';
        p.position = 0;
        p.startOuterIncome = passiveIncome(this.content, p) * outerIncomeMultiplier;
        p.outerIncome = p.startOuterIncome;
        this.events.push({ type: 'escaped', playerId: p.id, turn: p.turnsTaken, outerIncome: p.outerIncome });
      }
    }
    const current = this.current;
    if (
      !this.s.winnerId && current.circle === 'outer' &&
      current.outerIncome >= outerGoalMultiplier * current.startOuterIncome
    ) {
      this.win(current, 'income');
    }
    if (this.s.winnerId) {
      this.s.status = 'finished';
      this.events.push({ type: 'game_finished' });
      return;
    }
    this.s.pending = null;
    this.s.pendingResolved = false;
    this.s.lastRoll = null;
    const n = this.s.players.length;
    for (let step = 1; step <= n; step++) {
      const idx = (this.s.current + step) % n;
      const p = this.s.players[idx]!;
      if (p.turnsTaken < maxTurns) {
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

export function dreamPrice(content: Content, p: PlayerState): number {
  const dream = content.dreams.find((d) => d.id === p.dreamId);
  if (!dream) throw new Error(`Неизвестная мечта: ${p.dreamId}`);
  return Math.round(dream.priceInIncomes * content.rules.dreamPriceFactor * p.startOuterIncome);
}

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
      // действие приходит от клиента: без проверки dice: 0 оставлял фишку на месте, а dice: 50 давал полсотни кубиков
      if (dice !== 1 && dice !== 2) return fail('Бросают один или два кубика');
      if (dice === 2 && p.charityTurns === 0) return fail('Два кубика доступны только после «Помощи»');
      if (p.charityTurns > 0) p.charityTurns--;
      const roll = Array.from({ length: dice }, () => t.rng.int(1, 6));
      const total = roll.reduce((a, b) => a + b, 0);
      s.lastRoll = roll;
      p.turnsTaken++;
      const board = p.circle === 'inner' ? content.board : content.outerBoard;
      for (let i = 0; i < total; i++) {
        p.position = (p.position + 1) % board.cells.length;
        if (!board.paydayAt.includes(p.position)) continue;
        if (p.circle === 'inner') t.payday(p);
        else t.outerPayday(p);
      }
      t.events.push({ type: 'rolled', playerId: p.id, dice: roll, to: p.position });
      if (p.circle === 'inner') t.land(p);
      else t.landOuter(p);
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
      if (s.pending.deck === 'ventures') {
        const card = s.pending.card;
        const shares = action.shares ?? 1;
        if (!Number.isInteger(shares) || shares <= 0) return fail('Укажите целое число долей');
        const price = shares * card.cost;
        if (p.cash < price) return fail('Не хватает денег: на «Свободном пути» покупают только за наличные');
        p.cash -= price;
        p.ventures.push({
          id: `v${s.nextAssetId++}`, cardId: card.id, title: card.title, shares, cost: price, income: shares * card.income,
        });
        p.outerIncome += shares * card.income;
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price });
        s.phase = 'end';
        break;
      }
      if (s.pending.deck === 'everyday') {
        const card = s.pending.card;
        const amount = everydayAmount(content, p, card);
        if (card.kind === 'insurance') {
          p.policies.push({ risk: card.risk, premium: amount });
          t.events.push({ type: 'insured', playerId: p.id, risk: card.risk, premium: amount });
        } else if (card.kind === 'training') {
          if (p.cash < amount) return fail('Не хватает денег на обучение');
          const saving = trainingSaving(content, p, card);
          p.cash -= amount;
          p.savings += saving;
          t.events.push({ type: 'trained', playerId: p.id, cost: amount, saving });
        } else {
          return fail('Сейчас нечего покупать');
        }
        s.phase = 'end';
        break;
      }
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
      } else if (card.kind === 'bond') {
        const count = action.shares ?? 0;
        if (!Number.isInteger(count) || count <= 0) return fail('Укажите целое число облигаций');
        const price = count * card.price;
        if (p.cash < price) return fail('Не хватает денег на облигации');
        p.cash -= price;
        p.bonds.push({ id: `b${s.nextAssetId++}`, cardId: card.id, title: card.title, count, price: card.price, coupon: card.coupon });
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price });
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
      if (p.circle === 'outer') return fail('На «Свободном пути» активы «Круга забот» не продаются');
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
      // иначе вышедший игрок продал бы старые активы и купил мечту на эти деньги
      if (p.circle === 'outer') return fail('На «Свободном пути» активы «Круга забот» не продаются');
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
      const income = p.circle === 'inner' ? professionOf(content, p).salary + passiveIncome(content, p) : p.outerIncome;
      const amount = Math.round(rules.charityShare * income);
      if (p.cash < amount) return fail('Не хватает денег на пожертвование');
      p.cash -= amount;
      p.charityTurns = rules.charityTurns;
      t.events.push({ type: 'donated', playerId: p.id, amount });
      s.phase = 'end';
      break;
    }

    case 'BUY_DREAM': {
      if (!isCurrent || s.phase !== 'dream') return fail('Сейчас нельзя купить мечту');
      const price = dreamPrice(content, p);
      if (p.cash < price) return fail('Пока не хватает денег на мечту');
      p.cash -= price;
      t.win(p, 'dream');
      s.phase = 'end';
      break;
    }

    case 'TAKE_LOAN': {
      if (!isCurrent) return fail('Кредит берут только в свой ход');
      if (p.circle === 'outer') return fail('На «Свободном пути» кредитов нет');
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

    case 'DEPOSIT':
    case 'WITHDRAW': {
      if (!isCurrent) return fail('Вкладом распоряжаются только в свой ход');
      const { amount } = action;
      if (!Number.isInteger(amount) || amount <= 0 || amount % rules.depositStep !== 0) {
        return fail(`Сумма кратна ${rules.depositStep}`);
      }
      if (action.type === 'DEPOSIT') {
        if (amount > p.cash) return fail('Не хватает денег');
        p.cash -= amount;
        p.deposit += amount;
        t.events.push({ type: 'deposited', playerId: p.id, amount });
      } else {
        if (amount > p.deposit) return fail('На вкладе меньше');
        p.deposit -= amount;
        p.cash += amount;
        t.events.push({ type: 'withdrawn', playerId: p.id, amount, forced: false });
      }
      break;
    }

    case 'SELL_BOND': {
      if (!isCurrent) return fail('Облигации продают только в свой ход');
      const bond = p.bonds.find((b) => b.id === action.bondId);
      if (!bond) return fail('Таких облигаций нет');
      p.bonds = p.bonds.filter((b) => b !== bond);
      const proceeds = bond.count * bond.price;
      p.cash += proceeds;
      t.events.push({ type: 'bond_sold', playerId: p.id, bondId: bond.id, proceeds });
      break;
    }

    case 'CANCEL_POLICY': {
      if (!isCurrent) return fail('Полис отменяют только в свой ход');
      if (!p.policies.some((x) => x.risk === action.risk)) return fail('Такого полиса нет');
      p.policies = p.policies.filter((x) => x.risk !== action.risk);
      t.events.push({ type: 'policy_cancelled', playerId: p.id, risk: action.risk });
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

