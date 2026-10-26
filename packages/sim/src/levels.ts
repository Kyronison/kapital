import { contentForLevel, levels, type LevelTier } from '@kapital/content';
import { applyAction, botAction, createGame, levelProgress, type GameState } from '@kapital/engine';
import { parseArgs } from 'node:util';

/** Сколько партий бот должен проходить на каждой ступени: от почти всегда до примерно половины. */
const PASS_RATE: Record<LevelTier, [number, number]> = {
  novice: [0.85, 1],
  amateur: [0.7, 0.97],
  pro: [0.55, 0.92],
  expert: [0.4, 0.85],
  investor: [0.25, 0.75],
};
const MAX_ACTIONS = 20000;

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '400' },
    seed: { type: 'string', default: '1' },
    check: { type: 'boolean', default: false },
  },
});
const games = Number(values.games);
const baseSeed = Number(values.seed);

let failed = false;
console.log(`Уровни «Тренировки»: ${games} партий бота на уровень\n`);
console.log('Уровень       Лимит  Прошёл  Медиана  Звёзды 3/2/1');
for (const level of levels) {
  const content = contentForLevel(level);
  const turns: number[] = [];
  const stars = [0, 0, 0];
  for (let g = 0; g < games; g++) {
    let s: GameState = createGame(content, [{ id: 'bot', name: 'Бот', professionId: level.professionId, dreamId: level.dreamId }], baseSeed + g);
    let done = false;
    for (let i = 0; i < MAX_ACTIONS && s.status === 'playing' && !done; i++) {
      const r = applyAction(content, s, botAction(content, s, 'bot')!);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      done = levelProgress(content, level, s, s.players[0]!).done;
    }
    if (!done) continue;
    const t = s.players[0]!.turnsTaken;
    turns.push(t);
    stars[t <= level.stars[0] ? 0 : t <= level.stars[1] ? 1 : 2]!++;
  }
  turns.sort((a, b) => a - b);
  const rate = turns.length / games;
  const median = turns.length ? turns[Math.floor(turns.length / 2)]! : NaN;
  const [lo, hi] = PASS_RATE[level.tier];
  const bad = rate < lo || rate > hi;
  failed ||= bad;
  const pct = (n: number) => `${Math.round((n / games) * 100)}%`;
  console.log(
    `${level.id.padEnd(13)} ${String(level.maxTurns).padStart(5)}  ${pct(turns.length).padStart(6)}  ${String(median).padStart(7)}  ${stars.map(pct).join(' / ')}${bad ? `  ✗ нужно ${Math.round(lo * 100)}–${Math.round(hi * 100)}%` : ''}`,
  );
}
if (values.check && failed) {
  console.error('\nУровни вне коридора сложности');
  process.exit(1);
}
