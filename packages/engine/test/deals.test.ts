import { describe, expect, it } from 'vitest';
import type { AssetCard } from '@kapital/content';
import { botAction, expectedDeal, passiveIncome, type GameState } from '../src/index.js';
import { act, content, newGame, seedForRoll } from './helpers.js';

const card = (id: string) => [...content.smallDeals, ...content.bigDeals].find((c) => c.id === id) as AssetCard;

/** Игрок с картой сделки на столе; кубик после покупки выпадет на roll. */
function offer(id: string, roll = 6, cash = 100000): GameState {
  const s = structuredClone(newGame(['engineer']));
  s.players[0]!.cash = cash;
  s.phase = 'deal';
  s.pending = { deck: id.startsWith('studio') || id.startsWith('room') || id.startsWith('garage') || id.startsWith('vending') ? 'smallDeals' : 'bigDeals', card: card(id) };
  s.rng = seedForRoll(roll);
  return s;
}

describe('невыгодные и спорные сделки', () => {
  it('в колодах есть сделки хуже кредита: с минусом, с переплатой, с риском и стройкой', () => {
    const assets = [...content.smallDeals, ...content.bigDeals].filter((c): c is AssetCard => c.kind === 'asset');
    const bad = assets.filter((c) => {
      const e = expectedDeal(c);
      return e.flow / e.invested < content.rules.loanRate;
    });
    expect(bad.length).toBeGreaterThanOrEqual(12);
    expect(assets.some((c) => c.flow < 0)).toBe(true);
    expect(assets.some((c) => c.value !== undefined && c.value < c.cost)).toBe(true);
    expect(assets.some((c) => c.value !== undefined && c.value > c.cost)).toBe(true);
    expect(assets.some((c) => c.risk)).toBe(true);
    expect(assets.some((c) => c.later)).toBe(true);
  });

  it('скрытый дефект: выпало меньше odds — ремонт и поток ниже, иначе всё как обещано', () => {
    const c = card('studio-16');
    const lucky = act(offer('studio-16', c.risk!.odds), { type: 'BUY', playerId: 'p1' }).players[0]!;
    expect(lucky.assets[0]!.flow).toBe(c.flow);
    expect(lucky.cash).toBe(100000 - c.down);
    const unlucky = act(offer('studio-16', c.risk!.odds - 1), { type: 'BUY', playerId: 'p1' }).players[0]!;
    expect(unlucky.assets[0]!.flow).toBe(c.flow + c.risk!.flow!);
    expect(unlucky.cash).toBe(100000 - c.down - c.risk!.cash!);
  });

  it('стройка: поток меняется, когда пройдёт нужное число зарплат', () => {
    const c = card('room-15');
    let s = act(offer('room-15'), { type: 'BUY', playerId: 'p1' });
    expect(passiveIncome(content, s.players[0]!)).toBe(c.flow);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    const payday = content.board.paydayAt[1]!;
    for (let i = 0; i < c.later!.paydays; i++) {
      expect(s.players[0]!.assets[0]!.later).toBeDefined();
      s = structuredClone(s);
      s.players[0]!.position = payday - 1;
      s.rng = seedForRoll(1);
      s = act(s, { type: 'ROLL', playerId: 'p1' });
      s = act(s, { type: 'END_TURN', playerId: 'p1' });
    }
    expect(s.players[0]!.assets[0]!.later).toBeUndefined();
    expect(s.players[0]!.assets[0]!.flow).toBe(c.flow + c.later!.flow);
  });

  it('покупатели платят от рыночной цены, а не от покупной', () => {
    const c = card('studio-13');
    const s = act(offer('studio-13'), { type: 'BUY', playerId: 'p1' });
    const owned = s.players[0]!.assets[0]!;
    expect(owned.cost).toBe(c.value);
    expect(owned.mortgage).toBe(c.cost - c.down);
    // при 100% рыночной цены переплату не вернуть: выручка меньше взноса
    expect(owned.cost - owned.mortgage).toBeLessThan(c.down);
  });

  it('бот не покупает сделку, которая в среднем хуже кредита', () => {
    for (const id of ['studio-13', 'studio-15', 'vending-12', 'cafe-12', 'complex-12']) {
      expect(botAction(content, offer(id), 'p1')).toEqual({ type: 'END_TURN', playerId: 'p1' });
    }
    expect(botAction(content, offer('studio-1'), 'p1')).toEqual({ type: 'BUY', playerId: 'p1' });
  });
});

describe('профессии', () => {
  it('у каждой профессии есть описание и положительный поток, и все id разные', () => {
    expect(new Set(content.professions.map((p) => p.id)).size).toBe(content.professions.length);
    for (const p of content.professions) {
      const e = p.expenses;
      expect(p.about.length).toBeGreaterThan(10);
      expect(p.salary - (e.taxes + e.housing + e.car + e.loans + e.other)).toBeGreaterThan(0);
    }
  });

  it('стартовые активы профессии есть с первого хода', () => {
    const s = newGame(['realtor']);
    const prof = content.professions.find((p) => p.id === 'realtor')!;
    expect(s.players[0]!.assets.map((a) => a.title)).toEqual(prof.startAssets!.map((a) => a.title));
    expect(passiveIncome(content, s.players[0]!)).toBe(prof.startAssets![0]!.flow);
  });

  it('у каждой профессии есть своя дилемма', () => {
    for (const p of content.professions) {
      expect(content.everyday.some((c) => c.kind === 'dilemma' && c.professions?.includes(p.id))).toBe(true);
    }
  });
});
