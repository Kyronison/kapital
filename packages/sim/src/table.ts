import { contentFor, type Content, type GameMode } from '@kapital/content';
import { applyAction, botAction, createGame, Rng, type GameState } from '@kapital/engine';
import { parseArgs } from 'node:util';

/**
 * Партии на несколько ботов за одним столом: проверяет то, чего не видит одиночная симуляция, —
 * гонку за выход и шанс отыграться у тех, кто вышел позже.
 */

/** Целевые значения: первый вышедший не должен выигрывать почти всегда. */
const MAX_FIRST_ESCAPER_WINS = 0.65;
/** И не должен проигрывать чаще, чем выигрывать: выход первым остаётся главным преимуществом. */
const MIN_FIRST_ESCAPER_WINS = 0.35;
const MAX_ACTIONS_PER_GAME = 100000;

export interface TableResult {
  winnerId: string | null;
  firstEscaperId: string | null;
  /** Ходы победителя до победы. */
  turns: number | null;
}

/** Партия ботов: сначала ответные продажи соперников, потом ход текущего игрока. */
export function playTable(content: Content, professionIds: string[], seed: number): TableResult {
  let s: GameState = createGame(
    content,
    professionIds.map((professionId, i) => ({ id: `p${i + 1}`, name: `Бот ${i + 1}`, professionId })),
    seed,
  );
  let firstEscaperId: string | null = null;
  for (let i = 0; i < MAX_ACTIONS_PER_GAME && s.status === 'playing'; i++) {
    const currentId = s.players[s.current]!.id;
    const order = [...s.players.map((p) => p.id).filter((id) => id !== currentId), currentId];
    let acted = false;
    for (const id of order) {
      const action = botAction(content, s, id);
      if (!action) continue;
      const r = applyAction(content, s, action);
      if (!r.ok) throw new Error(`Бот сделал недопустимое действие ${action.type}: ${r.error}`);
      for (const e of r.events) if (e.type === 'escaped' && !firstEscaperId) firstEscaperId = e.playerId;
      s = r.state;
      acted = true;
      break;
    }
    if (!acted) throw new Error('Бот не нашёл действия в свой ход');
  }
  const winner = s.players.find((p) => p.id === s.winnerId);
  return { winnerId: s.winnerId, firstEscaperId, turns: winner?.wonAtTurn ?? null };
}

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '1000' },
    players: { type: 'string', default: '4' },
    seed: { type: 'string', default: '1' },
    check: { type: 'boolean', default: false },
    mode: { type: 'string', default: 'classic' },
    rules: { type: 'string' },
  },
});

const mode = values.mode as GameMode;
if (mode !== 'classic' && mode !== 'quick') throw new Error(`Неизвестный режим: ${mode}`);
const preset = contentFor(mode);
const content: Content = values.rules ? { ...preset, rules: { ...preset.rules, ...JSON.parse(values.rules) } } : preset;
const games = Number(values.games);
const players = Number(values.players);
const rng = new Rng(Number(values.seed) >>> 0);

let finished = 0;
let firstWins = 0;
const turns: number[] = [];
for (let g = 0; g < games; g++) {
  const profs = Array.from({ length: players }, () => content.professions[rng.int(0, content.professions.length - 1)]!.id);
  const r = playTable(content, profs, rng.int(0, 2 ** 31));
  if (!r.winnerId) continue;
  finished++;
  if (r.winnerId === r.firstEscaperId) firstWins++;
  if (r.turns !== null) turns.push(r.turns);
}
turns.sort((a, b) => a - b);
const share = finished ? firstWins / finished : 0;
console.log(`Режим ${mode}: ${games} партий на ${players} ботов, профессии случайные\n`);
console.log(`Партий с победителем         ${((finished / games) * 100).toFixed(1)}%`);
console.log(`Первый вышедший выигрывает   ${(share * 100).toFixed(1)}%`);
console.log(`Ходов победителя, медиана    ${turns[Math.floor(turns.length / 2)] ?? '—'}`);

if (share > MAX_FIRST_ESCAPER_WINS || share < MIN_FIRST_ESCAPER_WINS) {
  console.log(`\nДоля побед первого вышедшего вне коридора ${MIN_FIRST_ESCAPER_WINS * 100}–${MAX_FIRST_ESCAPER_WINS * 100}%`);
  if (values.check) process.exitCode = 1;
}
