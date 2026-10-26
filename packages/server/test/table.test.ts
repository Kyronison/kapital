import { defaultContent } from '@kapital/content';
import { describe, expect, it } from 'vitest';
import { Table } from '../src/table.js';

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
    expect(t.act('s1', { type: 'ROLL', playerId: 's2' }).ok).toBe(true);
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
    const t = tableWith('Аня');
    t.addBot('s1');
    t.addBot('s1');
    t.start('s1');
    t.leave('s1');
    let steps = 0;
    while (t.game!.status === 'playing' && steps < 100000) {
      if (!t.botStep()) break;
      steps++;
    }
    expect(t.game!.status).toBe('finished');
    expect(t.game!.winnerId).not.toBeNull();
  });
});
