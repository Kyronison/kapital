import { describe, expect, it } from 'vitest';
import { parseClientAction } from '../src/index.js';

describe('действия от клиента', () => {
  it('пропускает честные действия и отбрасывает лишние поля', () => {
    expect(parseClientAction({ type: 'ROLL' })).toEqual({ ok: true, value: { type: 'ROLL' } });
    expect(parseClientAction({ type: 'BUY', shares: 3, extra: 1 })).toEqual({ ok: true, value: { type: 'BUY', shares: 3 } });
    expect(parseClientAction({ type: 'TAKE_LOAN', amount: 2000 })).toEqual({ ok: true, value: { type: 'TAKE_LOAN', amount: 2000 } });
  });

  it('отбрасывает мусор', () => {
    for (const bad of [null, 'ROLL', [], { type: 'HACK' }, { type: 'ROLL', dice: 50 }, { type: 'BUY', shares: '3' },
      { type: 'TAKE_LOAN', amount: 1.5 }, { type: 'CHOOSE_DEAL', size: 'huge' }, { type: 'SELL_ASSET' }, { type: 'END_TURN', playerId: 'p2' }]) {
      expect(parseClientAction(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});
