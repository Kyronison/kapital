import type { Content } from '@kapital/content';
import { availableLoan, passiveIncome, professionOf, roundUpToStep } from './finance.js';
import type { Action, GameState, PlayerState } from './types.js';

/** Порог взноса, после которого бот смотрит в колоду «Проект». */
const BIG_DEAL_BUDGET = 15000;
/** Продавать актив, если выручка не меньше стольких периодов его потока. */
const SELL_AT_FLOWS = 10;
/** Минимальный запас наличных после досрочного погашения кредита. */
const CASH_RESERVE = 2000;

function reactiveSale(content: Content, s: GameState, p: PlayerState): Action | null {
  const pending = s.pending;
  if (!pending) return null;
  if (s.phase === 'market' && pending.deck === 'market' && pending.card.kind === 'offer') {
    const offer = pending.card;
    const asset = p.assets.find((a) =>
      a.assetType === offer.assetType &&
      Math.round(a.cost * offer.multiplier) - a.mortgage >= SELL_AT_FLOWS * Math.max(a.flow, 1));
    if (asset) return { type: 'SELL_ASSET', playerId: p.id, assetId: asset.id };
  }
  if (s.phase === 'deal' && pending.deck === 'smallDeals' && pending.card.kind === 'stock') {
    const card = pending.card;
    const h = p.stocks.find((x) => x.ticker === card.ticker);
    if (h && card.price >= 2 * h.avgPrice) return { type: 'SELL_STOCK', playerId: p.id, shares: h.shares };
  }
  return null;
}

/**
 * Простой бот: покупает сделки с доходностью выше ставки кредита, продаёт с большой прибылью.
 * Используется для симуляции баланса и для замены отключившихся игроков.
 * Возвращает null, если боту нечего делать вне своего хода.
 */
export function botAction(content: Content, s: GameState, playerId: string): Action | null {
  const p = s.players.find((x) => x.id === playerId);
  if (!p || s.status !== 'playing') return null;
  const sale = reactiveSale(content, s, p);
  if (sale) return sale;
  if (s.players[s.current]!.id !== playerId) return null;

  const { rules } = content;
  const end: Action = { type: 'END_TURN', playerId };

  switch (s.phase) {
    case 'roll':
      return { type: 'ROLL', playerId };

    case 'choose_deal': {
      const big = p.cash + availableLoan(content, p) >= BIG_DEAL_BUDGET && p.turnsTaken % 5 < 3;
      return { type: 'CHOOSE_DEAL', playerId, size: big ? 'big' : 'small' };
    }

    case 'deal': {
      const pending = s.pending;
      if (!pending || (pending.deck !== 'smallDeals' && pending.deck !== 'bigDeals')) return end;
      const card = pending.card;
      if (card.kind === 'asset') {
        const worth = card.flow > 0 && card.flow / card.down > rules.loanRate * 1.1;
        const short = card.down - p.cash;
        if (!worth || short > availableLoan(content, p)) return end;
        if (short > 0) return { type: 'TAKE_LOAN', playerId, amount: roundUpToStep(short, rules.loanStep) };
        return { type: 'BUY', playerId };
      }
      const holds = p.stocks.some((x) => x.ticker === card.ticker);
      if (!s.pendingResolved && card.price <= 10 && !holds) {
        const shares = Math.floor((p.cash * 0.5) / card.price);
        if (shares > 0) return { type: 'BUY', playerId, shares };
      }
      return end;
    }

    case 'charity': {
      const amount = Math.round(rules.charityShare * (professionOf(content, p).salary + passiveIncome(p)));
      return p.cash > 3 * amount ? { type: 'DONATE', playerId } : end;
    }

    case 'market':
    case 'end': {
      if (p.bankLoan > 0 && p.cash > 2 * CASH_RESERVE) {
        const amount = Math.min(
          p.bankLoan,
          Math.floor((p.cash - CASH_RESERVE) / rules.loanStep) * rules.loanStep,
        );
        if (amount > 0) return { type: 'REPAY_LOAN', playerId, amount };
      }
      return end;
    }
  }
}
