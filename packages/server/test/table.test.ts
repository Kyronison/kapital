import { defaultContent } from '@kapital/content';
import { describe, expect, it } from 'vitest';
import { LOG_LIMIT, REACTION_MS, Table } from '../src/table.js';

const content = defaultContent;

function seeded(seed = 1) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

function tableWith(...names: string[]) {
  const t = new Table(content, seeded());
  names.forEach((n, i) => t.join(`s${i + 1}`, n));
  return t;
}

describe('лобби', () => {
  it('первый вошедший — создатель стола, ботов добавляет только он', () => {
    const t = tableWith('Аня', 'Боря');
    expect(t.hostId).toBe('s1');
    expect(t.addBot('s2').ok).toBe(false);
    expect(t.addBot('s1').ok).toBe(true);
    expect(t.seats.map((s) => s.bot)).toEqual([false, false, true]);
  });

  it('создатель ушёл из лобби — хозяином становится следующий человек', () => {
    const t = tableWith('Аня', 'Боря');
    t.addBot('s1');
    t.leave('s1');
    expect(t.hostId).toBe('s2');
  });

  it('не больше шести мест', () => {
    const t = tableWith('1', '2', '3', '4', '5', '6');
    expect(t.join('s7', '7').ok).toBe(false);
  });

  it('можно играть одному против рынка', () => {
    const t = tableWith('Аня');
    expect(t.start('s1').ok).toBe(true);
    expect(t.game!.players).toHaveLength(1);
  });

  it('режим выбирает только создатель и только в лобби', () => {
    const t = tableWith('Аня', 'Боря');
    expect(t.setMode('s2', 'quick').ok).toBe(false);
    expect(t.setMode('s1', 'turbo').ok).toBe(false);
    expect(t.setMode('s1', 'quick').ok).toBe(true);
    t.start('s1');
    expect(t.content.rules.maxTurns).toBe(40);
    // в быстром режиме у каждого есть стартовый бизнес
    expect(t.game!.players.every((p) => p.assets.length === 1)).toBe(true);
    expect(t.setMode('s1', 'classic').ok).toBe(false);
  });

  it('время на ход выбирает создатель: 30, 60, 90 секунд или без таймера', () => {
    const t = tableWith('Аня', 'Боря');
    expect(t.view().turnSeconds).toBe(30);
    expect(t.setTurnSeconds('s2', 60).ok).toBe(false);
    expect(t.setTurnSeconds('s1', 45).ok).toBe(false);
    expect(t.setTurnSeconds('s1', 0).ok).toBe(true);
    expect(Table.restore(content, t.snapshot()).turnSeconds).toBe(0);
    t.start('s1');
    expect(t.setTurnSeconds('s1', 60).ok).toBe(false);
  });

  it('после старта новые игроки не входят, а вернувшиеся — да', () => {
    const t = tableWith('Аня', 'Боря');
    t.start('s1');
    expect(t.join('s9', 'Вася').ok).toBe(false);
    t.leave('s2');
    expect(t.seats[1]!.connected).toBe(false);
    expect(t.join('s2', '').ok).toBe(true);
    expect(t.seats[1]!.connected).toBe(true);
  });
});

describe('партия', () => {
  it('игрок не может сходить за другого, даже подставив чужой playerId', () => {
    const t = tableWith('Аня', 'Боря');
    t.start('s1');
    expect(t.act('s2', { type: 'ROLL', playerId: 's1' }).ok).toBe(false);
    // игрока определяет сервер: сообщение с playerId отбрасывается целиком
    expect(t.act('s1', { type: 'ROLL', playerId: 's2' }).ok).toBe(false);
    expect(t.act('s2', { type: 'ROLL' }).ok).toBe(false);
    expect(t.act('s1', { type: 'ROLL' }).ok).toBe(true);
  });

  it('клиенты не видят колоды и состояние ГПСЧ', () => {
    const t = tableWith('Аня', 'Боря');
    t.start('s1');
    const game = t.view().game as Record<string, unknown>;
    expect(game.decks).toBeUndefined();
    expect(game.rng).toBeUndefined();
    expect(game.seed).toBeUndefined();
    expect(game.players).toBeDefined();
  });

  it('по таймауту ход доигрывается и передаётся следующему', () => {
    const t = tableWith('Аня', 'Боря');
    t.start('s1');
    t.timeout();
    expect(t.game!.current).toBe(1);
    expect(t.game!.phase).toBe('roll');
  });

  it('боты доигрывают партию за себя и за отключившегося человека', () => {
    const t = tableWith('Аня', 'Боря');
    t.addBot('s1');
    t.start('s1');
    t.leave('s1');
    let steps = 0;
    // ходы Бори, который на связи, доигрывает таймер
    while (t.game!.status === 'playing' && steps < 100000) {
      // окно ответа Бори закрывает таймер комнаты
      if (!t.botStep() && !t.expireHold().length) t.timeout();
      steps++;
    }
    expect(t.game!.status).toBe('finished');
    expect(t.hostId).toBe('s2');
  });

  it('когда ушли все люди, партия встаёт на паузу', () => {
    const t = tableWith('Аня');
    t.addBot('s1');
    t.start('s1');
    t.leave('s1');
    expect(t.paused).toBe(true);
    expect(t.botStep()).toBeNull();
  });
});

describe('места и сохранение', () => {
  it('по ключу игрок возвращается на своё место с новым соединением', () => {
    const t = tableWith('Аня', 'Боря');
    const key = t.keyOf('s1')!;
    t.start('s1');
    t.leave('s1');
    expect(t.join('new', '', undefined, undefined, 'не тот').ok).toBe(false);
    const r = t.join('new', '', undefined, undefined, key);
    expect(r.ok && r.value.seatId).toBe('s1');
    expect(t.act('new', { type: 'ROLL' }).ok).toBe(true);
  });

  it('снимок стола восстанавливается: люди не на связи, ключи работают', () => {
    const t = tableWith('Аня');
    t.addBot('s1');
    t.start('s1');
    t.act('s1', { type: 'ROLL' });
    const copy = Table.restore(content, JSON.parse(JSON.stringify(t.snapshot())));
    expect(copy.game).toEqual(t.game);
    // журнал партии переживает перезапуск
    expect(copy.log.events.some((e) => e.type === 'rolled')).toBe(true);
    expect(copy.seats.map((s) => s.connected)).toEqual([false, true]);
    expect(copy.join('x', '', undefined, undefined, t.keyOf('s1')).ok).toBe(true);
    expect(copy.act('x', { type: 'END_TURN' }).ok).toBe(true);
  });

  it('журнал хранит последние события со сквозным номером', () => {
    const t = tableWith('Аня');
    t.addBot('s1');
    t.start('s1');
    let total = 0;
    while (t.game!.status === 'playing' && total < 3 * LOG_LIMIT) {
      const events = t.botStep() ?? t.timeout();
      total += events.length;
    }
    expect(t.log.events.length).toBeLessThanOrEqual(LOG_LIMIT);
    expect(t.log.start + t.log.events.length).toBe(total);
  });

  it('ключей мест нет в том, что видят клиенты', () => {
    const t = tableWith('Аня');
    expect(JSON.stringify(t.view())).not.toContain(t.keyOf('s1')!);
  });
});

describe('чат', () => {
  it('чистит пробелы, режет длину и не даёт заспамить', () => {
    let now = 0;
    const t = new Table(content, seeded(), () => now);
    t.join('s1', 'Аня');
    expect(t.say('s1', '   ').ok).toBe(false);
    expect(t.say('s1', 'при\n  вет').ok).toBe(true);
    expect(t.chat[0]!.text).toBe('при вет');
    t.say('s1', 'x'.repeat(500));
    expect(t.chat[1]!.text).toHaveLength(200);
    for (let i = 0; i < 3; i++) t.say('s1', 'ещё');
    expect(t.say('s1', 'шестое').ok).toBe(false);
    now = 11_000;
    expect(t.say('s1', 'снова можно').ok).toBe(true);
    expect(t.say('чужой', 'привет').ok).toBe(false);
  });
});

describe('«Тренировка»', () => {
  it('уровень задаёт профессию, лимит ходов и пускает только одного', () => {
    const t = new Table(content, seeded());
    expect(t.setLevel('нет такого').ok).toBe(false);
    expect(t.setLevel('pro-1').ok).toBe(true);
    t.join('s1', 'Аня', 'surgeon');
    expect(t.join('s2', 'Боря').ok).toBe(false);
    expect(t.addBot('s1').ok).toBe(false);
    t.start('s1');
    expect(t.game!.players[0]!.professionId).toBe('teacher');
    expect(t.content.rules.maxTurns).toBe(40);
    expect(t.view().level).toEqual({ id: 'pro-1', share: 0, result: null });
  });

  it('цель выполнена — партия закончена, за скорость звёзды', () => {
    const t = new Table(content, seeded());
    t.setLevel('novice-2');
    t.join('s1', 'Аня');
    t.start('s1');
    t.game!.players[0]!.cash = 10_000;
    t.act('s1', { type: 'ROLL' });
    expect(t.game!.status).toBe('finished');
    expect(t.view().level!.result).toEqual({ passed: true, stars: 3, turns: 1 });
  });

  it('ходы кончились — уровень не пройден', () => {
    const t = new Table(content, seeded());
    t.setLevel('pro-1');
    t.join('s1', 'Аня');
    t.start('s1');
    t.leave('s1');
    t.join('s1', '');
    while (t.game!.status === 'playing') t.timeout();
    const level = t.view().level!;
    if (level.result?.passed) expect(level.result.turns).toBeLessThanOrEqual(40);
    else expect(level.result).toEqual({ passed: false });
  });
});

describe('окно ответа', () => {
  /** Аня ходит и открывает цену TECH по 40, у Бори есть эти акции. */
  function stockOnTable(now = () => 1000) {
    const t = new Table(content, seeded(), now);
    t.join('s1', 'Аня');
    t.join('s2', 'Боря');
    t.start('s1');
    const g = structuredClone(t.game!);
    g.phase = 'deal';
    g.pending = { deck: 'smallDeals', card: content.smallDeals.find((c) => c.kind === 'stock' && c.ticker === 'TECH' && c.price === 40)! as never };
    g.players[1]!.stocks.push({ ticker: 'TECH', shares: 10, avgPrice: 5 });
    t.game = g;
    return t;
  }

  it('конец хода ждёт соперника, которому есть что продать', () => {
    const t = stockOnTable();
    expect(t.act('s1', { type: 'END_TURN' }).ok).toBe(true);
    expect(t.game!.current).toBe(0);
    expect(t.view().reaction).toEqual({ until: 1000 + REACTION_MS, waiting: ['s2'] });
    // текущий игрок уже ничего не делает
    expect(t.act('s1', { type: 'TAKE_LOAN', amount: 1000 }).ok).toBe(false);
    const r = t.act('s2', { type: 'SELL_STOCK', shares: 10 });
    expect(r.ok).toBe(true);
    expect(t.game!.current).toBe(1);
    expect(t.view().reaction).toBeNull();
  });

  it('«Пропустить» передаёт ход сразу, молчание — по времени', () => {
    const t = stockOnTable();
    t.act('s1', { type: 'END_TURN' });
    expect(t.pass('s1').ok).toBe(false);
    expect(t.pass('s2').ok).toBe(true);
    expect(t.game!.current).toBe(1);

    const u = stockOnTable();
    u.act('s1', { type: 'END_TURN' });
    expect(u.expireHold().some((e) => e.type === 'turn_started')).toBe(true);
    expect(u.game!.current).toBe(1);
  });

  it('бот и отключившийся игрок ход не держат', () => {
    const t = stockOnTable();
    t.leave('s2');
    expect(t.act('s1', { type: 'END_TURN' }).ok).toBe(true);
    expect(t.game!.current).toBe(1);
  });

  it('соперник ушёл во время ожидания — ход переходит', () => {
    const t = stockOnTable();
    t.act('s1', { type: 'END_TURN' });
    expect(t.leave('s2').some((e) => e.type === 'turn_started')).toBe(true);
  });
});
