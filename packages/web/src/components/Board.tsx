import { defaultContent as content } from '@kapital/content';
import type { ReactNode } from 'react';
import { CELL_TITLES, dreamTitle } from '../format.js';
import type { PublicGame } from '../net.js';

export const PLAYER_COLORS = ['#2f6fdb', '#d94f3d', '#2a9d6f', '#c48a12', '#8a4fd1', '#1c9bb5'];

/** Клетки идут по периметру квадрата по часовой стрелке от левого верхнего угла. */
function perimeter(size: number, i: number): [row: number, col: number] {
  const side = size - 1;
  if (i < side) return [0, i];
  if (i < 2 * side) return [i - side, side];
  if (i < 3 * side) return [side, 3 * side - i];
  return [4 * side - i, 0];
}

export function Board({ game, circle, center }: { game: PublicGame; circle: 'inner' | 'outer'; center: ReactNode }) {
  const board = circle === 'inner' ? content.board : content.outerBoard;
  const size = board.cells.length / 4 + 1;
  const current = game.players[game.current]!;
  return (
    <div className={`board ${circle}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {board.cells.map((cell, i) => {
        const [row, col] = perimeter(size, i);
        const here = game.players.filter((p) => p.circle === circle && p.position === i);
        const dreams = circle === 'outer' ? content.outerBoard.dreamsAt[i] : undefined;
        return (
          <div
            key={i}
            className={`cell ${cell}${current.circle === circle && current.position === i ? ' active' : ''}`}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
            title={dreams ? dreams.map((d) => dreamTitle(d)).join(', ') : undefined}
          >
            {board.paydayAt.includes(i) && <span className="payday" title="Зарплата">₭</span>}
            <span className="cell-name">{CELL_TITLES[cell]}</span>
            <span className="tokens">
              {here.map((p) => (
                <span
                  key={p.id}
                  className="token"
                  style={{ background: PLAYER_COLORS[game.players.indexOf(p) % PLAYER_COLORS.length] }}
                  title={p.name}
                />
              ))}
            </span>
          </div>
        );
      })}
      <div className="center" style={{ gridRow: `2 / ${size}`, gridColumn: `2 / ${size}` }}>
        {center}
      </div>
    </div>
  );
}
