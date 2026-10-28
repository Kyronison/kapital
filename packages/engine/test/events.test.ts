import { describe, expect, it } from 'vitest';
import { applyAction, botAction, cashflow, choiceOptions, passiveIncome, type GameState } from '../src/index.js';
import { act, cellIndex, content, newGame, placeBefore } from './helpers.js';

type Deck = keyof GameState['decks'];

/** Кладёт карту наверх колоды. */
function onTop(s: GameState, deck: Deck, cardId: string) {
  s.decks[deck] = { order: [cardId, ...s.decks[deck].order.filter((id) => id !== cardId)], pos: 0 };
}

/** Курьер (зарплата 2 000 К, наличные 900 К) встаёт на клетку, сверху колоды — нужная карта. */
function landOn(cell: string, deck: Deck, cardId: string, prepare?: (s: GameState) => void): GameState {
  const s = structuredClone(newGame());
  onTop(s, deck, cardId);
  prepare?.(s);
  return act(placeBefore(s, cellIndex(cell)), { type: 'ROLL', playerId: 'p1' });
}

/** Доходит до следующей зарплаты и завершает ход. */
function nextPayday(s: GameState): GameState {
  s = act(placeBefore(s, 6), { type: 'ROLL', playerId: 'p1' });
  if (s.phase === 'choice') s = act(s, { type: 'CHOOSE', playerId: 'p1', option: 0 });
  return act(s, { type: 'END_TURN', playerId: 'p1' });
}

const rich = (s: GameState) => { s.players[0]!.cash = 10000; };

describe('дилеммы', () => {
  it('ждут выбора, а выбранный вариант применяется', () => {
    let s = landOn('everyday', 'everyday', 'ev-dilemma-friend-loan', rich);
    expect(s.phase).toBe('choice');
    expect(choiceOptions(content, s)!.map((o) => o.label)).toEqual(['Одолжить', 'Отказаться']);
    expect(applyAction(content, s, { type: 'ROLL', playerId: 'p1' }).ok).toBe(false);
    expect(applyAction(content, s, { type: 'CHOOSE', playerId: 'p1', option: 5 }).ok).toBe(false);
    s = act(s, { type: 'CHOOSE', playerId: 'p1', option: 0 });
    expect(s.phase).toBe('end');
    expect(s.players[0]!.cash).toBe(10000 - 1000);
    expect(s.players[0]!.followUps).toEqual([{ event: 'fu-friend-loan', paydaysLeft: 3 }]);
  });

  it('продолжение истории случается через нужное число зарплат', () => {
    let s = landOn('everyday', 'everyday', 'ev-dilemma-friend-loan', rich);
    s = act(act(s, { type: 'CHOOSE', playerId: 'p1', option: 0 }), { type: 'END_TURN', playerId: 'p1' });
    const followed = (st: GameState) => st.players[0]!.followUps.length === 0;
    s = nextPayday(s);
    s = nextPayday(s);
    expect(followed(s)).toBe(false);
    const r = applyAction(content, placeBefore(s, 6), { type: 'ROLL', playerId: 'p1' });
    expect(r.ok && r.events.some((e) => e.type === 'follow_up' && e.event === 'fu-friend-loan')).toBe(true);
    expect(r.ok && r.events.some((e) => e.type === 'gambled')).toBe(true);
    expect(r.ok && followed(r.state)).toBe(true);
  });

  it('без выбора до конца хода срабатывает осторожный вариант', () => {
    let s = landOn('everyday', 'everyday', 'ev-dilemma-friend-loan', rich);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    expect(s.players[0]!.cash).toBe(10000);
    expect(s.players[0]!.followUps).toEqual([]);
  });

  it('карты чужой профессии не попадаются', () => {
    const s = landOn('everyday', 'everyday', 'ev-dilemma-surgeon-clinic');
    expect(s.pending?.card.id).not.toBe('ev-dilemma-surgeon-clinic');
  });

  it('подработка добавляется к зарплате, но не к пассивному доходу', () => {
    let s = landOn('everyday', 'everyday', 'ev-dilemma-weekend-job');
    s = act(s, { type: 'CHOOSE', playerId: 'p1', option: 0 });
    const p = s.players[0]!;
    expect(p.gigs).toEqual([{ title: 'Подработка по выходным', amount: 300, paydaysLeft: 4 }]);
    expect(passiveIncome(content, p)).toBe(0);
    expect(cashflow(content, p)).toBe(520 + 300);
  });
});

describe('соблазн в рассрочку', () => {
  it('можно оплатить сразу или в рассрочку дороже', () => {
    let s = landOn('temptation', 'temptations', 'tempt-18', rich);
    expect(s.phase).toBe('choice');
    s = act(s, { type: 'CHOOSE', playerId: 'p1', option: 1 });
    // 800 К × 1,25 на 4 зарплаты
    expect(s.players[0]!.subscriptions).toEqual([
      { cardId: 'Рассрочка: Новый ноутбук', title: 'Рассрочка: Новый ноутбук', amount: 250, paydaysLeft: 4 },
    ]);
    expect(s.players[0]!.cash).toBe(10000);
  });

  it('без выбора соблазн оплачивается сразу', () => {
    let s = landOn('temptation', 'temptations', 'tempt-18', rich);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    expect(s.players[0]!.cash).toBe(10000 - 800);
  });

  it('мелкий соблазн списывается без выбора', () => {
    const s = landOn('temptation', 'temptations', 'tempt-1', rich);
    expect(s.phase).toBe('end');
    expect(s.players[0]!.cash).toBe(10000 - 100);
  });
});

describe('новости рынка', () => {
  it('биржевой бум поднимает цену акций на несколько ходов того, кто вытянул', () => {
    let s = landOn('market', 'market', 'news-1', rich);
    expect(s.news).toMatchObject([{ cardId: 'news-1', ownerId: 'p1', turnsLeft: 4 }]);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    onTop(s, 'smallDeals', 'stock-1');
    s = act(placeBefore(s, cellIndex('opportunity')), { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'CHOOSE_DEAL', playerId: 'p1', size: 'small' });
    const card = s.pending!.card;
    expect(card).toMatchObject({ kind: 'stock', price: 8 });
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    expect(s.news[0]!.turnsLeft).toBe(2);
    s = nextPayday(nextPayday(s));
    expect(s.news).toEqual([]);
  });

  it('льготная ипотека снижает взнос, а поток уменьшается на платёж по большему долгу', () => {
    let s = landOn('market', 'market', 'news-5', rich);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    onTop(s, 'smallDeals', 'studio-1');
    s = act(placeBefore(s, cellIndex('opportunity')), { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'CHOOSE_DEAL', playerId: 'p1', size: 'small' });
    // 4 000 × 0,6 = 2 400 → 2 500; долг больше на 1 500, платёж 90 К
    expect(s.pending!.card).toMatchObject({ id: 'studio-1', down: 2500, flow: 210 });
  });
});

describe('дивидендные акции', () => {
  it('дивиденды идут в пассивный доход', () => {
    let s = structuredClone(newGame());
    rich(s);
    onTop(s, 'smallDeals', content.smallDeals.find((c) => c.kind === 'stock' && c.ticker === 'BANK')!.id);
    s = act(placeBefore(s, cellIndex('opportunity')), { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'CHOOSE_DEAL', playerId: 'p1', size: 'small' });
    s = act(s, { type: 'BUY', playerId: 'p1', shares: 100 });
    expect(passiveIncome(content, s.players[0]!)).toBe(100);
  });
});

describe('бот и новые события', () => {
  it('бот всегда выбирает допустимый вариант', () => {
    for (const id of content.everyday.filter((c) => c.kind === 'dilemma' && !c.professions).map((c) => c.id)) {
      const s = landOn('everyday', 'everyday', id);
      const a = botAction(content, s, 'p1')!;
      expect(a.type).toBe('CHOOSE');
      expect(applyAction(content, s, a).ok).toBe(true);
    }
  });
});
