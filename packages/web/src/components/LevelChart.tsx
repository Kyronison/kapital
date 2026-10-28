import { contentForLevel, type Level } from '@kapital/content';
import { applyAction, botAction, createGame, levelProgress, type GameState } from '@kapital/engine';
import { useMemo } from 'react';

const RUNS = 40;
const MAX_ACTIONS = 20000;

/**
 * «Пример стратегии»: как бот из симуляции проходит этот уровень. Берём медиану выполнения цели
 * по ходам из нескольких партий: у каждой свои броски и карты, поэтому это ориентир, а не точный путь.
 */
const cache = new Map<string, number[]>();

export function exampleCurve(level: Level): number[] {
  const hit = cache.get(level.id);
  if (hit) return hit;
  const curve = simulate(level);
  cache.set(level.id, curve);
  return curve;
}

function simulate(level: Level): number[] {
  const content = contentForLevel(level);
  const runs: number[][] = [];
  for (let seed = 1; seed <= RUNS; seed++) {
    let s: GameState = createGame(content, [{ id: 'bot', name: 'Бот', professionId: level.professionId, dreamId: level.dreamId }], seed);
    const curve = [levelProgress(content, level, s, s.players[0]!).share];
    let done = false;
    for (let i = 0; i < MAX_ACTIONS && s.status === 'playing' && !done; i++) {
      const action = botAction(content, s, 'bot');
      if (!action) break;
      const r = applyAction(content, s, action);
      if (!r.ok) break;
      s = r.state;
      const p = s.players[0]!;
      const progress = levelProgress(content, level, s, p);
      done = progress.done;
      curve[p.turnsTaken] = done ? 1 : progress.share;
      if (p.turnsTaken >= level.maxTurns) break;
    }
    // пропущенные ходы и хвост после победы заполняем последним значением
    for (let t = 0; t <= level.maxTurns; t++) curve[t] ??= done && t > 0 ? 1 : curve[t - 1] ?? 0;
    runs.push(curve.slice(0, level.maxTurns + 1));
  }
  return Array.from({ length: level.maxTurns + 1 }, (_, t) => {
    const at = runs.map((c) => c[t]!).sort((a, b) => a - b);
    return at[Math.floor(at.length / 2)]!;
  });
}

const W = 320;
const H = 150;
const PAD = { l: 34, r: 8, t: 10, b: 22 };

function path(points: (number | undefined)[], maxTurns: number): string {
  const x = (t: number) => PAD.l + (t / maxTurns) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  let d = '';
  points.forEach((v, t) => {
    if (v === undefined) return;
    d += `${d ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`;
  });
  return d;
}

/**
 * График выполнения цели по ходам у игрока и в примере стратегии. Во время уровня (`live`) ось идёт
 * чуть дальше текущего хода и под графиком видно, насколько игрок впереди или позади примера.
 */
export function LevelChart({ level, mine, live }: { level: Level; mine: (number | undefined)[]; live?: boolean }) {
  const example = useMemo(() => exampleCurve(level), [level]);
  const last = mine.reduce<number>((n, v, t) => (v === undefined ? n : t), 0);
  const turns = live ? Math.min(level.maxTurns, Math.max(last + 4, 8)) : Math.max(last, 1);
  const ticks = [0, 0.5, 1];
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const now = mine[last] ?? 0;
  const ref = example[last] ?? 0;
  const gap = Math.round((now - ref) * 100);
  return (
    <figure className={`level-chart${live ? ' live' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Выполнение цели по ходам: ваше и пример стратегии">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 1 ? 'goal' : 'grid'} />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{v * 100}%</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 4}>ход 0</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end">ход {turns}</text>
        <path d={path(example.slice(0, turns + 1), turns)} className="example" />
        <path d={path(mine.slice(0, turns + 1), turns)} className="mine" />
      </svg>
      <figcaption>
        <span className="legend mine">Вы{live ? `: ${Math.round(now * 100)}%` : ''}</span>
        <span className="legend example">Пример стратегии{live ? `: ${Math.round(ref * 100)}%` : ''}</span>
        {live ? (
          <span className={`gap ${gap >= 0 ? 'ahead' : 'behind'}`}>
            {gap > 0 ? `Вы впереди примера на ${gap}%` : gap < 0 ? `До примера не хватает ${-gap}%` : 'Идёте вровень с примером'}
          </span>
        ) : (
          <span className="muted">Пример — середина из {RUNS} партий бота на этом уровне. Карты у вас были другие, так что это ориентир, а не правильный ответ.</span>
        )}
      </figcaption>
    </figure>
  );
}
