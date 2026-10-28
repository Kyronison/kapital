import { contentForLevel, levels } from '@kapital/content';
import { describe, expect, it } from 'vitest';
import { advanceOptimal, applyAction, botAction, createGame, levelProgress, startOptimal } from '../src/index.js';

describe('лучший выбор', () => {
  it('на тех же картах проходит уровень не позже бота', () => {
    for (const id of ['novice-1', 'novice-3', 'novice-5']) {
      const level = levels.find((l) => l.id === id)!;
      const content = contentForLevel(level);
      for (const seed of [1, 2, 3]) {
        const initial = createGame(content, [{ id: 'p', name: 'P', professionId: level.professionId, dreamId: level.dreamId }], seed);
        let s = initial;
        let botTurn = Infinity;
        for (let i = 0; i < 5000 && s.status === 'playing'; i++) {
          const r = applyAction(content, s, botAction(content, s, 'p')!);
          if (!r.ok) break;
          s = r.state;
          if (levelProgress(content, level, s, s.players[0]!).done) {
            botTurn = s.players[0]!.turnsTaken;
            break;
          }
          if (s.players[0]!.turnsTaken > level.maxTurns) break;
        }
        let search = startOptimal(content, level, initial);
        while (search.curve.length <= Math.min(botTurn, level.maxTurns)) search = advanceOptimal(content, level, search);
        if (botTurn <= level.maxTurns) expect(search.curve[botTurn]).toBe(1);
        // кривая не убывает: это лучший результат к каждому ходу
        search.curve.forEach((v, t) => t && expect(v).toBeGreaterThanOrEqual(search.curve[t - 1]!));
      }
    }
  });

  it('цель «накопить» не выполняется кредитом', () => {
    const level = levels.find((l) => l.goal.kind === 'cash')!;
    const content = contentForLevel(level);
    const s = createGame(content, [{ id: 'p', name: 'P', professionId: level.professionId, dreamId: level.dreamId }], 1);
    const p = s.players[0]!;
    p.bankLoan = 50_000;
    p.cash += 50_000;
    expect(levelProgress(content, level, s, p).done).toBe(false);
  });
});
