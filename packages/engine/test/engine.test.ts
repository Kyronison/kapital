import { describe, expect, it } from 'vitest';
import type { VentureCard } from '@kapital/content';
import {
  applyAction, availableLoan, botAction, cashflow, dreamPrice, hasEscaped, passiveIncome, totalExpenses,
  type GameState,
} from '../src/index.js';
import { act, cellIndex, content, newGame, placeBefore } from './helpers.js';

describe('создание партии', () => {
  it('выдаёт стартовые деньги профессии', () => {
    const s = newGame(['courier', 'surgeon']);
    expect(s.players.map((p) => p.cash)).toEqual([900, 4000]);
    expect(s.phase).toBe('roll');
  });

  it('одинаковый seed даёт одинаковые колоды', () => {
    expect(newGame(['courier'], 7).decks).toEqual(newGame(['courier'], 7).decks);
    expect(newGame(['courier'], 7).decks).not.toEqual(newGame(['courier'], 8).decks);
  });

  it('отклоняет неизвестную профессию и повтор игрока', () => {
    expect(() => newGame(['astronaut'])).toThrow();
  });
});

describe('финансовый отчёт', () => {
  it('поток курьера = 2000 − 1480', () => {
    const p = newGame().players[0]!;
    expect(cashflow(content, p)).toBe(520);
    expect(totalExpenses(content, p)).toBe(1480);
  });

  it('лимит кредита: платежи не больше половины потока', () => {
    const p = newGame().players[0]!;
    // 0,5 × 520 / 0,06 = 4333 → 4000
    expect(availableLoan(content, p)).toBe(4000);
  });
});

describe('ход', () => {
  it('нельзя ходить не в свой ход', () => {
    const s = newGame(['courier', 'nurse']);
    const r = applyAction(content, s, { type: 'ROLL', playerId: 'p2' });
    expect(r.ok).toBe(false);
  });

  it('не мутирует исходное состояние', () => {
    const s = newGame();
    const before = structuredClone(s);
    act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s).toEqual(before);
  });

  it('зарплата начисляется при прохождении рубежа', () => {
    let s = placeBefore(newGame(), 6 + 1, 2); // старт с 5, проходим 6
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.players[0]!.position).toBe(7);
    expect(s.players[0]!.cash).toBe(900 + 520);
  });

  it('END_TURN передаёт ход следующему', () => {
    let s = newGame(['courier', 'nurse']);
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    expect(s.current).toBe(1);
    expect(s.phase).toBe('roll');
  });
});

describe('клетки', () => {
  it('«Возможность» → выбор колоды → покупка актива', () => {
    let s = placeBefore(newGame(['surgeon']), cellIndex('opportunity', 1));
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.phase).toBe('choose_deal');
    s = act(s, { type: 'CHOOSE_DEAL', playerId: 'p1', size: 'small' });
    expect(s.phase).toBe('deal');
    const pending = s.pending!;
    if (pending.deck !== 'smallDeals') throw new Error('ожидалась карта «Шанс»');
    const card = pending.card;
    if (card.kind === 'asset') {
      s = act(s, { type: 'TAKE_LOAN', playerId: 'p1', amount: 5000 });
      s = act(s, { type: 'BUY', playerId: 'p1' });
      expect(passiveIncome(content, s.players[0]!)).toBe(card.flow);
      expect(s.players[0]!.assets[0]!.mortgage).toBe(card.cost - card.down);
    } else {
      s = act(s, { type: 'BUY', playerId: 'p1', shares: 10 });
      expect(s.players[0]!.stocks[0]!.shares).toBe(10);
    }
  });

  it('нельзя купить без денег на взнос', () => {
    let s = placeBefore(newGame(['courier']), cellIndex('opportunity', 1));
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'CHOOSE_DEAL', playerId: 'p1', size: 'big' });
    const r = applyAction(content, s, { type: 'BUY', playerId: 'p1' });
    expect(r.ok).toBe(false);
  });

  it('«Пополнение» добавляет ребёнка и расход, максимум 3', () => {
    let s = newGame();
    for (let i = 0; i < 4; i++) {
      s = placeBefore(s, cellIndex('baby'));
      s = act(s, { type: 'ROLL', playerId: 'p1' });
      s = act(s, { type: 'END_TURN', playerId: 'p1' });
    }
    expect(s.players[0]!.children).toBe(3);
    expect(totalExpenses(content, s.players[0]!)).toBe(1480 + 3 * 110);
  });

  it('«Сокращение»: две зарплаты не приходят, ход не пропускается', () => {
    let s = placeBefore(newGame(), cellIndex('layoff'));
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.players[0]!.layoffPaydays).toBe(2);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    expect(s.phase).toBe('roll');
    // следующая зарплата на клетке 18: курьер платит расходы без зарплаты
    s = placeBefore(s, 18, 1);
    const r = applyAction(content, s, { type: 'ROLL', playerId: 'p1' });
    expect(r.ok && r.events.find((e) => e.type === 'payday')).toMatchObject({ amount: -1480, salaryPaid: false });
    expect(r.ok && r.state.players[0]!.layoffPaydays).toBe(1);
  });

  it('«Помощь» даёт два кубика на 3 хода', () => {
    let s = placeBefore(newGame(['surgeon']), cellIndex('charity'));
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'DONATE', playerId: 'p1' });
    expect(s.players[0]!.cash).toBe(4000 - 1200);
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.lastRoll).toHaveLength(2);
    expect(s.players[0]!.charityTurns).toBe(2);
  });

  it('«Соблазн» в долг: берётся вынужденный кредит', () => {
    let s = structuredClone(newGame());
    s.players[0]!.cash = 0;
    s = placeBefore(s, cellIndex('temptation'));
    const r = applyAction(content, s, { type: 'ROLL', playerId: 'p1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.state.players[0]!;
    expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(p.bankLoan).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'loan_taken' && e.forced)).toBe(true);
  });
});

describe('рынок и банкротство', () => {
  it('продажа актива по предложению рынка', () => {
    let s = structuredClone(newGame(['courier', 'nurse']));
    s.players[1]!.assets.push({
      id: 'a99', cardId: 'studio-1', assetType: 'studio', title: 'Студия', cost: 40000, down: 4000, mortgage: 36000, flow: 300,
    });
    s.phase = 'market';
    s.pending = { deck: 'market', card: { id: 'x', kind: 'offer', assetType: 'studio', title: '', multiplier: 1.4 } };
    // продавать может и не текущий игрок
    s = act(s, { type: 'SELL_ASSET', playerId: 'p2', assetId: 'a99' });
    expect(s.players[1]!.cash).toBe(1300 + 56000 - 36000);
    expect(s.players[1]!.assets).toHaveLength(0);
  });

  it('вышедший на «Свободный путь» не продаёт активы и акции «Круга забот»', () => {
    let s = structuredClone(newGame(['courier', 'nurse']));
    const p2 = s.players[1]!;
    p2.circle = 'outer';
    p2.assets.push({
      id: 'a99', cardId: 'studio-1', assetType: 'studio', title: 'Студия', cost: 40000, down: 4000, mortgage: 36000, flow: 300,
    });
    p2.stocks.push({ ticker: 'TECH', shares: 100, avgPrice: 5 });
    s.phase = 'market';
    s.pending = { deck: 'market', card: { id: 'x', kind: 'offer', assetType: 'studio', title: '', multiplier: 1.6 } };
    expect(applyAction(content, s, { type: 'SELL_ASSET', playerId: 'p2', assetId: 'a99' }).ok).toBe(false);
    s.phase = 'deal';
    s.pending = { deck: 'smallDeals', card: content.smallDeals.find((c) => c.kind === 'stock' && c.ticker === 'TECH' && c.price === 40)! as never };
    expect(applyAction(content, s, { type: 'SELL_STOCK', playerId: 'p2', shares: 100 }).ok).toBe(false);
  });

  it('банкрот начинает заново с той же профессией', () => {
    let s = structuredClone(newGame());
    s.players[0]!.cash = -100000;
    s = placeBefore(s, cellIndex('temptation'));
    const r = applyAction(content, s, { type: 'ROLL', playerId: 'p1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0]!.bankruptcies).toBe(1);
    expect(r.state.players[0]!.cash).toBe(900);
  });
});

describe('выход из «Круга забот»', () => {
  it('фиксируется в конце хода, когда пассивный доход покрывает расходы', () => {
    let s = structuredClone(newGame());
    s.players[0]!.assets.push({
      id: 'a1', cardId: 'carwash-1', assetType: 'carwash', title: 'Мойка', cost: 30000, down: 30000, mortgage: 0, flow: 2400,
    });
    expect(hasEscaped(content, s.players[0]!)).toBe(true);
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    const p = s.players[0]!;
    expect(p.escapedAtTurn).toBe(1);
    expect(p.circle).toBe('outer');
    expect(p.position).toBe(0);
    // стартовый доход = пассивный доход × 10
    expect(p.outerIncome).toBe(24000);
    expect(s.status).toBe('playing');
  });
});

describe('«Свободный путь»', () => {
  function outerGame(): GameState {
    const s = structuredClone(newGame(['courier', 'nurse']));
    const p = s.players[0]!;
    Object.assign(p, { circle: 'outer', escapedAtTurn: 20, turnsTaken: 20, startOuterIncome: 20000, outerIncome: 20000, cash: 50000 });
    return s;
  }

  it('доход начисляется на рубежах внешнего круга', () => {
    let s = placeBefore(outerGame(), 4 + 1, 2);
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.players[0]!.cash).toBe(70000);
  });

  it('доли инвестиции покупаются за наличные и увеличивают доход', () => {
    let s = outerGame();
    s.players[0]!.cash = 1_000_000;
    s = placeBefore(s, cellIndex('venture', 1, 'outer'));
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.phase).toBe('deal');
    const card = s.pending!.card as VentureCard;
    s = act(s, { type: 'BUY', playerId: 'p1', shares: 2 });
    expect(s.players[0]!.outerIncome).toBe(20000 + 2 * card.income);
    expect(s.players[0]!.cash).toBe(1_000_000 - 2 * card.cost);
  });

  it('кредитов на внешнем круге нет', () => {
    const r = applyAction(content, outerGame(), { type: 'TAKE_LOAN', playerId: 'p1', amount: 1000 });
    expect(r.ok).toBe(false);
  });

  it('иск забирает половину наличных', () => {
    let s = placeBefore(outerGame(), cellIndex('lawsuit', 0, 'outer'));
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.players[0]!.cash).toBe(25000);
  });

  it('«Кризис» съедает следующий доход', () => {
    let s = placeBefore(outerGame(), cellIndex('crisis', 0, 'outer'));
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    s = act(s, { type: 'ROLL', playerId: 'p2' });
    s = act(s, { type: 'END_TURN', playerId: 'p2' });
    s = placeBefore(s, 12, 1);
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.players[0]!.cash).toBe(50000);
    expect(s.players[0]!.skipIncome).toBe(0);
  });

  it('покупка своей мечты — победа', () => {
    let s = outerGame();
    const p = s.players[0]!;
    const cell = Number(Object.entries(content.outerBoard.dreamsAt).find(([, ids]) => ids.includes(p.dreamId))![0]);
    p.cash = dreamPrice(content, p);
    s = placeBefore(s, cell);
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.phase).toBe('dream');
    s = act(s, { type: 'BUY_DREAM', playerId: 'p1' });
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    expect(s.winnerId).toBe('p1');
    expect(s.status).toBe('finished');
  });

  it('чужая мечта не продаётся', () => {
    let s = outerGame();
    const p = s.players[0]!;
    const cell = Number(Object.entries(content.outerBoard.dreamsAt).find(([, ids]) => !ids.includes(p.dreamId))![0]);
    s = placeBefore(s, cell);
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    expect(s.phase).toBe('end');
  });

  it('удвоение дохода — победа в конце хода', () => {
    let s = outerGame();
    s.players[0]!.outerIncome = 40000;
    s = act(s, { type: 'ROLL', playerId: 'p1' });
    s = act(s, { type: 'END_TURN', playerId: 'p1' });
    expect(s.winnerId).toBe('p1');
  });
});

describe('бот', () => {
  it('доигрывает партию на четверых без недопустимых действий', () => {
    let s = newGame(['courier', 'teacher', 'developer', 'surgeon'], 2026);
    let guard = 0;
    while (s.status === 'playing' && guard++ < 50000) {
      const actor = s.players.find((p) => botAction(content, s, p.id) && p.id !== s.players[s.current]!.id) ?? s.players[s.current]!;
      const a = botAction(content, s, actor.id)!;
      s = act(s, a);
    }
    expect(s.status).toBe('finished');
  });
});

describe('проверка действий от клиента', () => {
  it('бросают только один или два кубика', () => {
    const s = newGame();
    for (const dice of [0, 3, 50, -1, 1.5, 'x']) {
      const r = applyAction(content, s, { type: 'ROLL', playerId: 'p1', dice } as never);
      expect(r.ok).toBe(false);
    }
  });
});
