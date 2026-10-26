import { defaultContent, type Content } from '@kapital/content';
import { applyAction, botAction, createGame, type GameState } from '@kapital/engine';
import { parseArgs } from 'node:util';

/** Целевой коридор: медиана ходов до выхода из «Круга забот» для каждой профессии. */
const TARGET_MEDIAN: [number, number] = [20, 30];
/** Допустимая доля партий, в которых бот не вышел за лимит ходов. */
const MAX_TIMEOUT_SHARE = 0.05;
/** Защита от зацикливания бота внутри одного хода. */
const MAX_ACTIONS_PER_GAME = 20000;

export function playSolo(content: Content, professionId: string, seed: number): number {
  let s: GameState = createGame(content, [{ id: 'bot', name: 'Бот', professionId }], seed);
  for (let i = 0; i < MAX_ACTIONS_PER_GAME && s.status === 'playing'; i++) {
    const action = botAction(content, s, 'bot');
    if (!action) throw new Error('Бот не нашёл действия в свой ход');
    const r = applyAction(content, s, action);
    if (!r.ok) throw new Error(`Бот сделал недопустимое действие ${action.type}: ${r.error}`);
    s = r.state;
  }
  const p = s.players[0]!;
  return p.escapedAtTurn ?? content.rules.maxTurns;
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '2000' },
    seed: { type: 'string', default: '1' },
    check: { type: 'boolean', default: false },
  },
});

const content = defaultContent;
const games = Number(values.games);
const baseSeed = Number(values.seed);
const failures: string[] = [];

console.log(`Симуляция: ${games} партий на профессию, ставка кредита ${content.rules.loanRate * 100}%\n`);
console.log('Профессия      Поток  Медиана  25%–75%  Не вышли');
for (const prof of content.professions) {
  const results: number[] = [];
  for (let g = 0; g < games; g++) results.push(playSolo(content, prof.id, baseSeed * 100003 + g));
  results.sort((a, b) => a - b);
  const median = quantile(results, 0.5);
  const timeouts = results.filter((r) => r >= content.rules.maxTurns).length / games;
  const e = prof.expenses;
  const flow = prof.salary - (e.taxes + e.housing + e.car + e.loans + e.other);
  console.log(
    `${prof.title.padEnd(13)} ${String(flow).padStart(6)} ${String(median).padStart(8)}` +
      `  ${String(quantile(results, 0.25)).padStart(3)}–${String(quantile(results, 0.75)).padEnd(3)}` +
      `  ${(timeouts * 100).toFixed(1).padStart(6)}%`,
  );
  if (median < TARGET_MEDIAN[0] || median > TARGET_MEDIAN[1]) {
    failures.push(`${prof.title}: медиана ${median} вне коридора ${TARGET_MEDIAN.join('–')}`);
  }
  if (timeouts > MAX_TIMEOUT_SHARE) {
    failures.push(`${prof.title}: ${(timeouts * 100).toFixed(1)}% партий без выхода`);
  }
}

if (failures.length) {
  console.log('\nБаланс вне целевых значений:\n- ' + failures.join('\n- '));
  if (values.check) process.exitCode = 1;
}
