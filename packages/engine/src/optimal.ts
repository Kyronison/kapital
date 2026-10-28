import type { Content, Level } from '@kapital/content';
import { availableLoan, cashflow, everydayAmount, passiveIncome, roundUpToStep, totalExpenses } from './finance.js';
import { applyAction, choiceOptions, dreamPrice } from './game.js';
import { levelProgress } from './level.js';
import type { Action, GameState, PlayerState } from './types.js';

/**
 * «Лучший выбор» на уровне «Тренировки»: перебор решений на тех же кубиках и в тех же колодах,
 * что у игрока. Порядок колод и бросков задан зерном партии и почти не зависит от решений,
 * поэтому это честное сравнение: что можно было успеть с теми картами, что выпали.
 *
 * Полный перебор растёт экспоненциально, поэтому после каждого хода оставляем `width` лучших
 * состояний (лучевой поиск). Половину отбираем по выполнению цели, половину по запасу на будущее:
 * иначе поиск выбрасывал бы ветки, которые копят на крупную сделку.
 */
export interface OptimalSearch {
  beam: GameState[];
  /** Лучшее выполнение цели после каждого хода, от 0 до 1; [0] — старт. */
  curve: number[];
}

const WIDTH = 40;

export function startOptimal(content: Content, level: Level, initial: GameState): OptimalSearch {
  const p = initial.players[0]!;
  return { beam: [initial], curve: [levelProgress(content, level, initial, p).share] };
}

/** Ещё один ход поиска: возвращает новое состояние, исходное не меняет. */
export function advanceOptimal(content: Content, level: Level, search: OptimalSearch, width = WIDTH): OptimalSearch {
  if (search.curve.at(-1) === 1 || search.beam.length === 0) return { ...search, curve: [...search.curve, 1] };
  const seen = new Map<string, GameState>();
  for (const s of search.beam) {
    for (const next of playTurn(content, level, s)) {
      const key = keyOf(next);
      if (!seen.has(key)) seen.set(key, next);
    }
  }
  const all = [...seen.values()].map((s) => ({ s, share: shareOf(content, level, s), potential: potentialOf(content, level, s) }));
  const best = Math.max(search.curve.at(-1)!, ...all.map((x) => x.share));
  if (best >= 1) return { beam: [], curve: [...search.curve, 1] };
  const byShare = [...all].sort((a, b) => b.share - a.share || b.potential - a.potential);
  const byPotential = [...all].sort((a, b) => b.potential - a.potential || b.share - a.share);
  const kept = new Set<GameState>();
  for (let i = 0; kept.size < width && i < all.length; i++) {
    kept.add(byShare[i]!.s);
    if (kept.size < width) kept.add(byPotential[i]!.s);
  }
  return { beam: [...kept], curve: [...search.curve, best] };
}

function shareOf(content: Content, level: Level, s: GameState): number {
  const p = s.players[0]!;
  const r = levelProgress(content, level, s, p);
  return r.done ? 1 : r.share;
}

/** Деньги на руках минус долг: из них вырастет будущий доход. */
function liquid(p: PlayerState): number {
  const stocks = p.stocks.reduce((sum, h) => sum + h.shares * h.avgPrice, 0);
  const bonds = p.bonds.reduce((sum, b) => sum + b.count * b.price, 0);
  return p.cash + p.deposit + stocks + bonds - p.bankLoan;
}

/** Оценка на будущее в долях цели: поток плюс то, что можно купить на свободные деньги. */
function potentialOf(content: Content, level: Level, s: GameState): number {
  const p = s.players[0]!;
  if (p.circle === 'outer') return 1 + p.outerIncome;
  const yieldRate = content.rules.loanRate;
  const passive = passiveIncome(content, p) + yieldRate * Math.max(0, liquid(p));
  const g = level.goal;
  switch (g.kind) {
    case 'passive':
      return passive / g.amount;
    case 'cash': {
      const left = Math.max(0, level.maxTurns - p.turnsTaken);
      return (liquid(p) + (cashflow(content, p) * left) / 2) / g.amount;
    }
    case 'cover':
      return passive / Math.max(1, totalExpenses(content, p)) / g.share;
    case 'escape':
    case 'win':
      return passive / Math.max(1, totalExpenses(content, p));
  }
}

function keyOf(s: GameState): string {
  const p = s.players[0]!;
  return JSON.stringify([s.rng, s.phase, s.decks.smallDeals.pos, s.decks.bigDeals.pos, s.news, p]);
}

const MAX_STEPS = 40;

/** Все концы одного хода: от броска до передачи хода (или конца партии). */
function playTurn(content: Content, level: Level, start: GameState): GameState[] {
  const out: GameState[] = [];
  const id = start.players[0]!.id;
  const walk = (s: GameState, steps: number, rolled: boolean) => {
    if (s.status !== 'playing' || (rolled && s.phase === 'roll') || steps > MAX_STEPS) {
      out.push(s);
      return;
    }
    for (const plan of choices(content, s, id)) {
      let cur = s;
      let ok = true;
      for (const action of plan) {
        const r = applyAction(content, cur, action);
        if (!r.ok) {
          ok = false;
          break;
        }
        cur = r.state;
        // как на сервере: цель проверяется после каждого действия, и уровень сразу заканчивается
        if (levelProgress(content, level, cur, cur.players[0]!).done) {
          cur = { ...cur, status: 'finished', winnerId: id };
          break;
        }
      }
      if (ok) walk(cur, steps + plan.length, rolled || plan.some((a) => a.type === 'ROLL'));
    }
  };
  walk(start, 0, false);
  return out;
}

/** Разумные варианты в текущей фазе. Каждый вариант — цепочка действий (например, кредит и покупка). */
function choices(content: Content, s: GameState, playerId: string): Action[][] {
  const p = s.players.find((x) => x.id === playerId)!;
  const { rules } = content;
  const end = finish(content, p);
  switch (s.phase) {
    case 'roll':
      return [[{ type: 'ROLL', playerId }]];
    case 'choose_deal':
      return [[{ type: 'CHOOSE_DEAL', playerId, size: 'small' }], [{ type: 'CHOOSE_DEAL', playerId, size: 'big' }]];
    case 'charity':
      return [[{ type: 'DONATE', playerId }], ...end];
    case 'dream':
      return p.cash >= dreamPrice(content, p) ? [[{ type: 'BUY_DREAM', playerId }]] : end;
    case 'choice':
      return (choiceOptions(content, s) ?? []).map((_, option) => [{ type: 'CHOOSE', playerId, option } as Action]);
    case 'market': {
      const pending = s.pending;
      if (pending?.deck !== 'market' || pending.card.kind !== 'offer' || p.circle === 'outer') return end;
      const type = pending.card.assetType;
      const sell: Action[] = p.assets.filter((a) => a.assetType === type).map((a) => ({ type: 'SELL_ASSET', playerId, assetId: a.id }));
      return sell.length ? [sell, ...end] : end;
    }
    case 'end':
      return end;
    case 'deal': {
      const pending = s.pending;
      if (!pending || s.pendingResolved) return end;
      if (pending.deck === 'ventures') {
        const card = pending.card;
        const most = Math.floor(p.cash / card.cost);
        const counts = [...new Set([most, card.odds === undefined ? most : Math.floor(most / 2)])].filter((n) => n > 0);
        return [...counts.map((shares) => [{ type: 'BUY', playerId, shares } as Action]), ...end];
      }
      if (pending.deck === 'everyday') {
        const card = pending.card;
        if (card.kind !== 'insurance' && card.kind !== 'training') return end;
        if (card.kind === 'training' && p.cash < everydayAmount(content, p, card)) return end;
        return [[{ type: 'BUY', playerId }], ...end];
      }
      if (pending.deck !== 'smallDeals' && pending.deck !== 'bigDeals') return end;
      const card = pending.card;
      if (card.kind === 'asset') {
        const short = card.down - p.cash;
        if (short <= 0) return [[{ type: 'BUY', playerId }], ...end];
        const loan = roundUpToStep(short, rules.loanStep);
        if (loan > availableLoan(content, p)) return end;
        return [[{ type: 'TAKE_LOAN', playerId, amount: loan }, { type: 'BUY', playerId }], ...end];
      }
      const most = Math.floor(p.cash / card.price);
      if (card.kind === 'bond') return most > 0 ? [[{ type: 'BUY', playerId, shares: most }], ...end] : end;
      const plans: Action[][] = [];
      const held = p.stocks.find((h) => h.ticker === card.ticker);
      if (held) plans.push([{ type: 'SELL_STOCK', playerId, shares: held.shares }, ...end[0]!]);
      if (most > 0) plans.push([{ type: 'BUY', playerId, shares: most }]);
      return [...plans, ...end];
    }
  }
}

/** Конец хода: просто передать ход или сначала погасить кредит всем, что есть. */
function finish(content: Content, p: PlayerState): Action[][] {
  const endTurn: Action = { type: 'END_TURN', playerId: p.id };
  const { loanStep } = content.rules;
  const repay = Math.min(p.bankLoan, Math.floor(p.cash / loanStep) * loanStep);
  if (p.circle === 'outer' || repay <= 0) return [[endTurn]];
  return [[endTurn], [{ type: 'REPAY_LOAN', playerId: p.id, amount: repay }, endTurn]];
}
