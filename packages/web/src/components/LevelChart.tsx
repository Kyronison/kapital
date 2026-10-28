import type { Level } from '@kapital/content';
import type { LevelTrack } from '@kapital/protocol';
import { useState } from 'react';

const W = 320;
const H = 150;
const PAD = { l: 34, r: 10, t: 10, b: 22 };

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * График выполнения цели по ходам: у игрока и «лучший выбор» — что можно было успеть на тех же
 * кубиках и картах, если на каждом ходу решать лучшим образом. Сервер считает его не дальше
 * текущего хода, поэтому будущие карты график не выдаёт. Наведение или нажатие на ход показывает значения.
 * Во время уровня (`live`) ось идёт чуть дальше текущего хода.
 */
export function LevelChart({ level, track, live }: { level: Level; track: LevelTrack; live?: boolean }) {
  const { mine, best } = track;
  const last = Math.max(0, mine.length - 1);
  const turns = live ? Math.min(level.maxTurns, Math.max(last + 4, 8)) : Math.max(last, 1);
  const [hover, setHover] = useState<number | null>(null);
  const x = (t: number) => PAD.l + (t / turns) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const line = (points: number[]) => points.map((v, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const now = mine[last] ?? 0;
  const top = best[last] ?? now;
  const gap = Math.round((top - now) * 100);
  const shown = hover ?? null;
  const step = (W - PAD.l - PAD.r) / turns;
  return (
    <figure className={`level-chart${live ? ' live' : ''}`}>
      <div className="level-chart-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Выполнение цели по ходам: ваше и лучший выбор"
          onMouseLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 1 ? 'goal' : 'grid'} />
              <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{v * 100}%</text>
            </g>
          ))}
          <text x={PAD.l} y={H - 4}>ход 0</text>
          <text x={W - PAD.r} y={H - 4} textAnchor="end">ход {turns}</text>
          {shown !== null && <line className="cursor" x1={x(shown)} x2={x(shown)} y1={PAD.t} y2={H - PAD.b} />}
          <path d={line(best)} className="best" />
          <path d={line(mine)} className="mine" />
          {best.map((v, t) => <circle key={`b${t}`} className={`dot best${t === shown ? ' on' : ''}`} cx={x(t)} cy={y(v)} r={t === shown ? 4 : 2.5} />)}
          {mine.map((v, t) => <circle key={`m${t}`} className={`dot mine${t === shown ? ' on' : ''}`} cx={x(t)} cy={y(v)} r={t === shown ? 4.5 : 3} />)}
          {mine.map((_, t) => (
            <rect
              key={`h${t}`} className="hit" x={x(t) - step / 2} y={0} width={step} height={H}
              onMouseEnter={() => setHover(t)} onClick={() => setHover(t)}
            />
          ))}
        </svg>
        {shown !== null && (
          <div className={`level-chart-tip${shown > turns / 2 ? ' left' : ''}`} style={{ left: `${(x(shown) / W) * 100}%` }} role="status">
            <b>Ход {shown}</b>
            <span className="mine">Вы: {pct(mine[shown] ?? 0)}</span>
            <span className="best">Лучший выбор: {pct(best[shown] ?? 0)}</span>
          </div>
        )}
      </div>
      <figcaption>
        <span className="legend mine">Вы{live ? `: ${pct(now)}` : ''}</span>
        <span className="legend best">Лучший выбор{live ? `: ${pct(top)}` : ''}</span>
        {live ? (
          <span className={`gap ${gap <= 0 ? 'ahead' : 'behind'}`}>
            {gap <= 0 ? 'Вы идёте как лучший выбор' : `До лучшего выбора не хватает ${gap}%`}
          </span>
        ) : (
          <span className="muted">Лучший выбор — сколько можно было успеть на тех же кубиках и картах, если на каждом ходу решать лучшим образом. Наведите на ход, чтобы увидеть значения.</span>
        )}
      </figcaption>
    </figure>
  );
}
