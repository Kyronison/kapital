import { describe, expect, it } from 'vitest';
import { applyAction, cashflow, passiveIncome, type GameState } from '../src/index.js';
import { act, cellIndex, content, newGame, placeBefore } from './helpers.js';

/** Курьер открывает «Шанс», сверху колоды — нужная карта. */
function drawSmall(cardId: string, prepare?: (s: GameState) => void): GameState {
  let s = structuredClone(newGame());
  s.decks.smallDeals = { order: [cardId, ...s.decks.smallDeals.order.filter((id) => id !== cardId)], pos: 0 };
  prepare?.(s);
  s = act(placeBefore(s, cellIndex('opportunity', 1)), { type: 'ROLL', playerId: 'p1' });
  return act(s, { type: 'CHOOSE_DEAL', playerId: 'p1', size: 'small' });
}

describe('вклад', () => {
  it('приносит процент как пассивный доход и снимается в свой ход', () => {
    let s = drawSmall('studio-1', (x) => { x.players[0]!.cash = 5000; });
    s = act(s, { type: 'DEPOSIT', playerId: 'p1', amount: 3000 });
    expect(s.players[0]!.cash).toBe(2000);
    expect(passiveIncome(content, s.players[0]!)).toBe(30);
    expect(cashflow(content, s.players[0]!)).toBe(520 + 30);
    expect(applyAction(content, s, { type: 'DEPOSIT', playerId: 'p1', amount: 1500 }).ok).toBe(false);
    expect(applyAction(content, s, { type: 'WITHDRAW', playerId: 'p1', amount: 4000 }).ok).toBe(false);
    s = act(s, { type: 'WITHDRAW', playerId: 'p1', amount: 1000 });
    expect(s.players[0]!.deposit).toBe(2000);
  });

  it('при нехватке денег сначала тратится вклад, а не берётся кредит', () => {
    let s = structuredClone(newGame());
    s.players[0]!.cash = 0;
    s.players[0]!.deposit = 5000;
    s = act(placeBefore(s, cellIndex('temptation')), { type: 'ROLL', playerId: 'p1' });
    const p = s.players[0]!;
    expect(p.bankLoan).toBe(0);
    expect(p.deposit).toBeLessThan(5000);
    expect(p.cash).toBeGreaterThanOrEqual(0);
  });
});

describe('облигации', () => {
  it('покупаются штуками, дают купон и возвращаются по номиналу', () => {
    expect(applyAction(content, drawSmall('bond-2'), { type: 'BUY', playerId: 'p1', shares: 3 }).ok).toBe(false);
    let s = drawSmall('bond-2', (x) => { x.players[0]!.cash = 3000; });
    s = act(s, { type: 'BUY', playerId: 'p1', shares: 3 });
    expect(s.players[0]!.cash).toBe(0);
    expect(passiveIncome(content, s.players[0]!)).toBe(120);
    const id = s.players[0]!.bonds[0]!.id;
    s = act(s, { type: 'SELL_BOND', playerId: 'p1', bondId: id });
    expect(s.players[0]!.cash).toBe(3000);
    expect(s.players[0]!.bonds).toEqual([]);
  });
});

describe('акции', () => {
  it('на карте есть диапазон цены этой акции', () => {
    const stock = content.smallDeals.find((c) => c.kind === 'stock' && c.ticker === 'GOLD');
    expect(stock && stock.kind === 'stock' && [stock.low, stock.high]).toEqual([5, 40]);
  });
});
