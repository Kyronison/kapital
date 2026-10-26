import { describe, expect, it } from 'vitest';
import { applyAction, botAction, cashflow, totalExpenses, type GameState } from '../src/index.js';
import { act, cellIndex, content, newGame, placeBefore } from './helpers.js';

/** Курьер (зарплата 2 000 К) встаёт на «Будни», сверху колоды — нужная карта. */
function landOn(cardId: string, prepare?: (s: GameState) => void): GameState {
  const s = structuredClone(newGame());
  s.decks.everyday = { order: [cardId, ...s.decks.everyday.order.filter((id) => id !== cardId)], pos: 0 };
  prepare?.(s);
  return act(placeBefore(s, cellIndex('everyday')), { type: 'ROLL', playerId: 'p1' });
}

describe('«Будни»', () => {
  it('неприятность без полиса оплачивается из наличных', () => {
    const s = landOn('ev-health-2');
    expect(s.players[0]!.cash).toBe(900 - 800);
    expect(s.phase).toBe('end');
  });

  it('полис покрывает свою неприятность, но не чужую', () => {
    const insured = (s: GameState) => { s.players[0]!.policies = [{ risk: 'health', premium: 60 }]; };
    expect(landOn('ev-health-2', insured).players[0]!.cash).toBe(900);
    expect(landOn('ev-property-2', insured).players[0]!.cash).toBe(100);
  });

  it('полис оформляется со взносом в расходы и отменяется в свой ход', () => {
    let s = landOn('ev-ins-life');
    expect(s.phase).toBe('deal');
    const before = totalExpenses(content, s.players[0]!);
    s = act(s, { type: 'BUY', playerId: 'p1' });
    expect(totalExpenses(content, s.players[0]!)).toBe(before + 60);
    expect(applyAction(content, s, { type: 'CANCEL_POLICY', playerId: 'p1', risk: 'property' }).ok).toBe(false);
    s = act(s, { type: 'CANCEL_POLICY', playerId: 'p1', risk: 'health' });
    expect(totalExpenses(content, s.players[0]!)).toBe(before);
  });

  it('второй такой же полис не предлагается', () => {
    const s = landOn('ev-ins-life', (x) => { x.players[0]!.policies = [{ risk: 'health', premium: 60 }]; });
    expect(s.phase).toBe('end');
  });

  it('подписка входит в расходы и заканчивается через несколько зарплат', () => {
    let s = landOn('ev-monthly-1');
    const p = s.players[0]!;
    expect(p.subscriptions).toEqual([{ cardId: 'ev-monthly-1', title: 'Подписка на кино и музыку', amount: 60, paydaysLeft: 4 }]);
    expect(cashflow(content, p)).toBe(520 - 60);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    for (let i = 0; i < 4; i++) {
      s = act(placeBefore(s, 6), { type: 'ROLL', playerId: 'p1' });
      s = act(s, { type: 'END_TURN', playerId: 'p1' });
    }
    expect(s.players[0]!.subscriptions).toEqual([]);
  });

  it('тренинг стоит денег и навсегда снижает расходы', () => {
    let s = landOn('ev-training-1');
    expect(s.phase).toBe('deal');
    s = act(s, { type: 'BUY', playerId: 'p1' });
    const p = s.players[0]!;
    expect(p.cash).toBe(900 - 800);
    expect(p.savings).toBe(60);
    expect(cashflow(content, p)).toBe(520 + 60);
  });

  it('на тренинг без денег не записывают', () => {
    const s = landOn('ev-training-2');
    expect(applyAction(content, s, { type: 'BUY', playerId: 'p1' }).ok).toBe(false);
  });

  it('премия приходит на счёт', () => {
    expect(landOn('ev-windfall-1').players[0]!.cash).toBe(900 + 1000);
  });

  it('бот берёт полис, когда поток позволяет', () => {
    const s = landOn('ev-ins-life');
    expect(botAction(content, s, 'p1')).toEqual({ type: 'BUY', playerId: 'p1' });
  });
});
