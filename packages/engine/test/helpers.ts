import { defaultContent, type Content } from '@kapital/content';
import { applyAction, createGame, type Action, type GameState } from '../src/index.js';

export const content: Content = defaultContent;

export function newGame(professions: string[] = ['courier'], seed = 42): GameState {
  return createGame(content, professions.map((professionId, i) => ({ id: `p${i + 1}`, name: `Игрок ${i + 1}`, professionId })), seed);
}

export function act(s: GameState, action: Action): GameState {
  const r = applyAction(content, s, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Ставит текущего игрока перед клеткой и подменяет ГПСЧ так, чтобы выпало нужное число. */
export function placeBefore(s: GameState, cell: number, roll = 1): GameState {
  const out = structuredClone(s);
  const p = out.players[out.current]!;
  const n = content.board.cells.length;
  p.position = (cell - roll + n) % n;
  out.rng = seedForRoll(roll);
  return out;
}

/** Подбирает состояние ГПСЧ, при котором первый бросок одного кубика равен roll. */
export function seedForRoll(roll: number): number {
  for (let seed = 1; ; seed++) {
    const next = (seed + 0x6d2b79f5) >>> 0;
    let t = next;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    if (1 + Math.floor(v * 6) === roll) return seed;
  }
}

export function cellIndex(kind: string, nth = 0): number {
  const idx = content.board.cells.flatMap((c, i) => (c === kind ? [i] : []))[nth];
  if (idx === undefined) throw new Error(`Нет клетки ${kind}`);
  return idx;
}
