import {
  offerTitle,
  type ChoiceOption, type Content, type DealCard, type Effect, type EverydayCard, type MarketCard, type NewsEffect,
  type TemptationCard, type VentureCard,
} from '@kapital/content';
import {
  availableLoan, baseExpenses, effectAmount, everydayAmount, gigIncome, hasEscaped, passiveIncome, professionOf,
  roundUpToStep, totalExpenses, trainingSaving,
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
      gigs: [],
      followUps: [],
    };
  });

  let nextAssetId = 1;
  for (const p of players) {
    for (const a of professionOf(content, p).startAssets ?? []) {
      p.assets.push({
        id: `a${nextAssetId++}`, cardId: 'profession', assetType: a.assetType, title: a.title,
        cost: a.cost, down: a.cost - a.mortgage, mortgage: a.mortgage, flow: a.flow,
      });
    }
  }
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
    news: [],
  };
}

/** Сохранения старых версий: полей для новых событий в них нет. */
function normalize(s: GameState) {
  s.news ??= [];
  for (const p of s.players) {
    p.gigs ??= [];
    p.followUps ??= [];
  }
}

/** Варианты на выбор, если игрок сейчас решает дилемму или как оплатить соблазн. */
export function choiceOptions(content: Content, s: Pick<GameState, 'phase' | 'pending'>): ChoiceOption[] | null {
  const pending = s.pending;
  if (s.phase !== 'choice' || !pending) return null;
  if (pending.deck === 'everyday' && pending.card.kind === 'dilemma') return pending.card.options;
  if (pending.deck === 'temptations' && pending.card.installments) {
    const { amount, installments, title } = pending.card;
    const monthly = Math.round((amount * (1 + content.rules.installmentMarkup)) / installments / 10) * 10;
    return [
      { label: 'Оплатить сразу', effects: [{ kind: 'cash', amount: -amount }] },
      {
        label: `В рассрочку на ${installments} зарплаты`,
        effects: [{ kind: 'monthly', amount: monthly, paydays: installments, title: `Рассрочка: ${title}` }],
      },
    ];
  }
  return null;
}

/** Что выбирается, если игрок не решил: у дилеммы — последний, осторожный вариант, у соблазна — оплата сразу. */
export function defaultOption(s: Pick<GameState, 'pending'>): number {
  const pending = s.pending;
  return pending?.deck === 'everyday' && pending.card.kind === 'dilemma' ? pending.card.options.length - 1 : 0;
}

/** Общий множитель действующих новостей нужного вида. */
function newsFactor<K extends NewsEffect['kind']>(
  s: GameState, kind: K, pick: (e: Extract<NewsEffect, { kind: K }>) => number,
): number {
  return s.news.reduce((f, n) => (n.effect.kind === kind ? f * pick(n.effect as Extract<NewsEffect, { kind: K }>) : f), 1);
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

  /** Тянет карту. Карты, которые не подходят игроку (`fits`), уходят под низ колоды. */
  draw<T extends DealCard | MarketCard | TemptationCard | EverydayCard | VentureCard>(
    deck: DeckName, fits: (card: T) => boolean = () => true,
  ): T {
    const d = this.s.decks[deck];
    for (let tries = 0; ; tries++) {
      if (d.pos >= d.order.length) {
        d.order = this.rng.shuffle(d.order);
        d.pos = 0;
      }
      const id = d.order[d.pos++]!;
      const card = (this.content[deck] as { id: string }[]).find((c) => c.id === id) as T | undefined;
      if (!card) throw new Error(`Карта ${id} не найдена в колоде ${deck}`);
      if (!fits(card) && tries < d.order.length) continue;
      this.events.push({ type: 'card_drawn', playerId: this.current.id, deck, cardId: id });
      return card;
    }
  }

  /** Карта сделки с поправкой на новости: цена акций и первый взнос. */
  adjustDeal(card: DealCard): DealCard {
    if (card.kind === 'stock') {
      const f = newsFactor(this.s, 'stocks', (e) => (!e.tickers || e.tickers.includes(card.ticker) ? e.factor : 1));
      return f === 1 ? card : { ...card, price: Math.max(1, Math.round(card.price * f)) };
    }
    if (card.kind === 'asset') {
      const f = newsFactor(this.s, 'down', (e) => (e.assetTypes.includes(card.assetType) ? e.factor : 1));
      if (f === 1) return card;
      const down = Math.min(card.cost, Math.max(500, Math.round((card.down * f) / 500) * 500));
      // взнос меньше — долг больше, и платёж по нему съедает часть потока; взнос больше — наоборот
      const flow = card.flow + Math.round(((down - card.down) * this.content.rules.loanRate) / 10) * 10;
      return { ...card, down, flow };
    }
    return card;
  }

  adjustMarket(card: MarketCard): MarketCard {
    if (card.kind !== 'offer') return card;
    const bonus = this.s.news.reduce(
      (b, n) => (n.effect.kind === 'offers' && n.effect.assetTypes.includes(card.assetType) ? b + n.effect.bonus : b), 0,
    );
    if (bonus === 0) return card;
    const multiplier = Math.round((card.multiplier + bonus) * 100) / 100;
    return { ...card, multiplier, title: offerTitle(card.assetType, multiplier) };
  }

  adjustTemptation(card: TemptationCard): TemptationCard {
    const f = newsFactor(this.s, 'temptations', (e) => e.factor);
    return f === 1 ? card : { ...card, amount: Math.max(10, Math.round((card.amount * f) / 10) * 10) };
  }

  /** Последствия решения или события. */
  applyEffects(p: PlayerState, effects: Effect[], reason: string) {
    for (const e of effects) {
      switch (e.kind) {
        case 'cash': {
          const amount = effectAmount(this.content, p, e);
          if (amount < 0) this.pay(p, -amount, reason);
          else if (amount > 0) {
            p.cash += amount;
            this.events.push({ type: 'received', playerId: p.id, amount, reason });
          }
          break;
        }
        case 'monthly': {
          const amount = effectAmount(this.content, p, e);
          p.subscriptions.push({ cardId: e.title, title: e.title, amount, paydaysLeft: e.paydays });
          this.events.push({ type: 'subscribed', playerId: p.id, title: e.title, amount, paydays: e.paydays });
          break;
        }
        case 'gig': {
          const amount = effectAmount(this.content, p, e);
          p.gigs.push({ title: e.title, amount, paydaysLeft: e.paydays });
          this.events.push({ type: 'gig_started', playerId: p.id, title: e.title, amount, paydays: e.paydays });
          break;
        }
        case 'saving': {
          const amount = effectAmount(this.content, p, e);
          p.savings += amount;
          this.events.push({ type: 'trained', playerId: p.id, cost: 0, saving: amount });
          break;
        }
        case 'skipSalary':
          p.layoffPaydays += e.paydays;
          this.events.push({ type: 'laid_off', playerId: p.id });
          break;
        case 'later':
          p.followUps.push({ event: e.event, paydaysLeft: e.paydays });
          break;
        case 'gamble': {
          const roll = this.rng.int(1, 6);
          const success = roll >= e.odds;
          this.events.push({ type: 'gambled', playerId: p.id, roll, odds: e.odds, success });
          this.applyEffects(p, success ? e.win : e.lose, reason);
          break;
        }
      }
    }
  }

  /** Продолжения историй, срок которых подошёл. */
  followUps(p: PlayerState) {
    for (const f of p.followUps) f.paydaysLeft--;
    const due = p.followUps.filter((f) => f.paydaysLeft <= 0);
    p.followUps = p.followUps.filter((f) => f.paydaysLeft > 0);
    for (const f of due) {
      const card = this.content.followUps.find((x) => x.id === f.event);
      if (!card) continue;
      this.events.push({ type: 'follow_up', playerId: p.id, event: card.id, title: card.title });
      this.applyEffects(p, card.effects, card.title);
    }
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
    const amount = salary + gigIncome(p) + passiveIncome(this.content, p) - totalExpenses(this.content, p);
    p.cash += amount;
    this.events.push({ type: 'payday', playerId: p.id, amount, salaryPaid });
    for (const sub of p.subscriptions) sub.paydaysLeft--;
    p.subscriptions = p.subscriptions.filter((x) => x.paydaysLeft > 0);
    for (const g of p.gigs) g.paydaysLeft--;
    p.gigs = p.gigs.filter((x) => x.paydaysLeft > 0);
    for (const a of p.assets) {
      if (!a.later || --a.later.paydaysLeft > 0) continue;
      a.flow += a.later.flow;
      this.events.push({ type: 'asset_ready', playerId: p.id, assetId: a.id, title: `${a.title}: ${a.later.title.toLowerCase()}`, flow: a.flow });
      delete a.later;
    }
    this.settle(p);
    this.followUps(p);
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
      p.gigs = [];
      p.followUps = [];
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
        const card = this.adjustMarket(this.draw<MarketCard>('market'));
        this.s.pending = { deck: 'market', card };
        if (card.kind === 'offer') {
          this.s.phase = 'market';
          return;
        }
        if (card.kind === 'news') {
          // та же новость второй раз продлевает срок, а не удваивает эффект
          this.s.news = this.s.news.filter((n) => n.cardId !== card.id);
          this.s.news.push({ cardId: card.id, title: card.title, effect: card.effect, ownerId: p.id, turnsLeft: card.turns });
          this.events.push({ type: 'news', playerId: p.id, cardId: card.id, title: card.title, turns: card.turns });
          this.s.phase = 'end';
          return;
        }
        if (p.assets.some((a) => card.assetTypes.includes(a.assetType))) {
          this.pay(p, card.amount, card.title);
        }
        this.s.phase = 'end';
        return;
      }
      case 'temptation': {
        const card = this.adjustTemptation(this.draw<TemptationCard>('temptations'));
        this.s.pending = { deck: 'temptations', card };
        if (card.installments) {
          this.s.phase = 'choice';
          return;
        }
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
    const card = this.draw<EverydayCard>(
      'everyday', (c) => c.kind !== 'dilemma' || !c.professions || c.professions.includes(p.professionId),
    );
    this.s.pending = { deck: 'everyday', card };
    this.s.phase = 'end';
    if (card.kind === 'dilemma') {
      this.s.phase = 'choice';
      return;
    }
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

  /** Выбор варианта: дилемма или способ оплаты соблазна. */
  choose(p: PlayerState, option: number) {
    const options = choiceOptions(this.content, this.s)!;
    const chosen = options[option]!;
    const pending = this.s.pending!;
    this.s.phase = 'end';
    this.events.push({ type: 'chose', playerId: p.id, cardId: pending.card.id, label: chosen.label });
    this.applyEffects(p, chosen.effects, pending.card.title);
  }

  advanceTurn() {
    const { maxTurns, outerIncomeMultiplier, outerGoalMultiplier } = this.content.rules;
    // срок новости идёт ходами того, кто её вытянул
    for (const n of this.s.news) if (n.ownerId === this.current.id) n.turnsLeft--;
    for (const n of this.s.news.filter((x) => x.turnsLeft <= 0)) {
      this.events.push({ type: 'news_ended', cardId: n.cardId, title: n.title });
    }
    this.s.news = this.s.news.filter((x) => x.turnsLeft > 0);
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

/**
 * Насколько игрок «Свободного пути» близок к победе, от 0 до 1: главный путь — накопить на мечту,
 * запасной — вырастить доход до цели.
 */
export function outerProgress(content: Content, p: PlayerState): number {
  if (p.circle !== 'outer' || p.startOuterIncome <= 0) return 0;
  const income = p.outerIncome / (content.rules.outerGoalMultiplier * p.startOuterIncome);
  return Math.min(1, Math.max(income, p.cash / dreamPrice(content, p)));
}

/** Единственная точка изменения состояния. Не мутирует входной state. */
export function applyAction(content: Content, state: GameState, action: Action): ActionResult {
  if (state.status !== 'playing') return fail('Партия завершена');
  const s = structuredClone(state);
  normalize(s);
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
      s.pending = { deck, card: t.adjustDeal(t.draw<DealCard>(deck)) };
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
        if (card.odds !== undefined) {
          const roll = t.rng.int(1, 6);
          const success = roll >= card.odds;
          t.events.push({ type: 'venture_rolled', playerId: p.id, cardId: card.id, roll, success });
          if (!success) {
            t.events.push({ type: 'paid', playerId: p.id, amount: price, reason: `${card.title}: проект закрылся` });
            s.phase = 'end';
            break;
          }
        }
        p.ventures.push({
          id: `v${s.nextAssetId++}`, cardId: card.id, title: card.title, shares, cost: price, income: shares * card.income,
        });
        p.outerIncome += shares * card.income;
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price, count: shares });
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
        const owned = {
          id: `a${s.nextAssetId++}`,
          cardId: card.id,
          assetType: card.assetType,
          title: card.title,
          cost: card.value ?? card.cost,
          down: card.down,
          mortgage: card.cost - card.down,
          flow: card.flow,
          ...(card.later ? { later: { flow: card.later.flow, paydaysLeft: card.later.paydays, title: card.later.title } } : {}),
        };
        p.assets.push(owned);
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price: card.down });
        if (card.risk) {
          // дефект проверяют сразу после покупки: отказаться уже нельзя
          const roll = t.rng.int(1, 6);
          const hit = roll < card.risk.odds;
          t.events.push({ type: 'deal_risk', playerId: p.id, cardId: card.id, title: card.risk.title, roll, odds: card.risk.odds, hit });
          if (hit) {
            owned.flow += card.risk.flow ?? 0;
            if (card.risk.cash) t.pay(p, card.risk.cash, `${card.title}: ${card.risk.title.toLowerCase()}`);
          }
        }
        s.phase = 'end';
      } else if (card.kind === 'bond') {
        const count = action.shares ?? 0;
        if (!Number.isInteger(count) || count <= 0) return fail('Укажите целое число облигаций');
        const price = count * card.price;
        if (p.cash < price) return fail('Не хватает денег на облигации');
        p.cash -= price;
        p.bonds.push({ id: `b${s.nextAssetId++}`, cardId: card.id, title: card.title, count, price: card.price, coupon: card.coupon });
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price, count });
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
          p.stocks.push({ ticker: card.ticker, shares, avgPrice: card.price, ...(card.dividend ? { dividend: card.dividend } : {}) });
        }
        t.events.push({ type: 'bought', playerId: p.id, cardId: card.id, price, count: shares });
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

    case 'CHOOSE': {
      if (!isCurrent || s.phase !== 'choice') return fail('Сейчас не из чего выбирать');
      const options = choiceOptions(content, s);
      if (!options || !Number.isInteger(action.option) || !options[action.option]) return fail('Такого варианта нет');
      t.choose(p, action.option);
      break;
    }

    case 'END_TURN': {
      if (!isCurrent || s.phase === 'roll') return fail('Сначала бросьте кубик');
      // не выбрал до конца хода — срабатывает вариант по умолчанию, иначе соблазн можно было бы не оплатить
      if (s.phase === 'choice') t.choose(p, defaultOption(s));
      t.advanceTurn();
      break;
    }

    default:
      return fail('Неизвестное действие');
  }

  s.rng = t.rng.state;
  return { ok: true, state: s, events: t.events };
}

