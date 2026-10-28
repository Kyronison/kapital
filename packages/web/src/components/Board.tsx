import { content } from '../content.js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { art, Icon, playerColor, Token } from '../art.js';
import { CELL_SHORT, CELL_TITLES, cellArt, cellHelp, dreamTitle, PAYDAY_HELP } from '../format.js';
import type { PublicGame } from '../net.js';

/** Клетки идут по периметру квадрата по часовой стрелке от левого верхнего угла. */
function perimeter(size: number, i: number): [row: number, col: number] {
  const side = size - 1;
  if (i < side) return [0, i];
  if (i < 2 * side) return [i - side, side];
  if (i < 3 * side) return [side, 3 * side - i];
  return [4 * side - i, 0];
}

const STEP_MS = 180;

/**
 * Позиции фишек на экране: догоняют настоящие по одной клетке за шаг,
 * чтобы было видно, как фишка идёт по полю.
 */
function useSteppedPositions(game: PublicGame) {
  const target = new Map(game.players.map((p) => [p.id, `${p.circle}:${p.position}`]));
  const [shown, setShown] = useState(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const key = [...target.values()].join('|');

  useEffect(() => {
    const t = setInterval(() => {
      setShown((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, want] of targetRef.current) {
          const have = prev.get(id);
          if (have === want) continue;
          changed = true;
          const [hc, hp] = (have ?? want).split(':');
          const [wc] = want.split(':');
          if (!have || hc !== wc) {
            next.set(id, want);
            continue;
          }
          const len = (hc === 'inner' ? content.board : content.outerBoard).cells.length;
          next.set(id, `${hc}:${(Number(hp) + 1) % len}`);
        }
        if (!changed) clearInterval(t);
        return changed ? next : prev;
      });
    }, STEP_MS);
    return () => clearInterval(t);
  }, [key]);

  return shown;
}

export function Board({ game, circle, center }: { game: PublicGame; circle: 'inner' | 'outer'; center: ReactNode }) {
  const board = circle === 'inner' ? content.board : content.outerBoard;
  const size = board.cells.length / 4 + 1;
  const current = game.players[game.current]!;
  const shown = useSteppedPositions(game);
  const [info, setInfo] = useState<number | null>(null);
  return (
    <div className={`board ${circle}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}>
      <div
        className="board-art"
        style={{ gridRow: `2 / ${size}`, gridColumn: `2 / ${size}`, backgroundImage: `url(${art(`board/center-${circle}.webp`)})` }}
        aria-hidden="true"
      />
      <div className="board-frame" aria-hidden="true" />
      {board.cells.map((cell, i) => {
        const [row, col] = perimeter(size, i);
        const here = game.players.filter((p) => shown.get(p.id) === `${circle}:${i}`);
        const dreams = circle === 'outer' ? content.outerBoard.dreamsAt[i] : undefined;
        const active = current.circle === circle && current.position === i && game.status === 'playing';
        const title = CELL_TITLES[cell] ?? cell;
        const picture = cellArt(cell, i, circle, dreams);
        return (
          <div
            key={i}
            className={`cell ${cell}${cell === 'dream' ? ' cell-dream' : ''}${active ? ' active cell-pulse' : ''}`}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
            title={dreams ? `${title}: ${dreams.map((d) => dreamTitle(d)).join(', ')}` : title}
            role="button"
            tabIndex={0}
            aria-label={`${title}: что здесь происходит`}
            onClick={() => setInfo(i)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setInfo(i))}
          >
            {board.paydayAt.includes(i) && (
              <span className="payday" title="Зарплата"><Icon name="cell-payday" label="Зарплата" /></span>
            )}
            {picture && <img className="cell-art" src={art(picture)} alt="" loading="lazy" />}
            <Icon name={`cell-${cell}`} />
            <span className="cell-name">{title}</span>
            <span className="cell-short" aria-hidden="true">{CELL_SHORT[cell] ?? title}</span>
            {here.length > 0 && (
              <span className="tokens">
                {here.map((p) => (
                  <span key={`${p.id}-${i}`} className="token-hop">
                    <Token color={playerColor(game.players.indexOf(p))} label={p.name} />
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      })}
      <div className="center" style={{ gridRow: `2 / ${size}`, gridColumn: `2 / ${size}` }}>
        {center}
      </div>
      {info !== null && (
        <CellInfo
          game={game} circle={circle} index={info} shown={shown}
          onClose={() => setInfo(null)}
        />
      )}
    </div>
  );
}

/** Карточка клетки по нажатию: что это за клетка и что на ней происходит. */
function CellInfo({ game, circle, index, shown, onClose }: {
  game: PublicGame; circle: 'inner' | 'outer'; index: number; shown: Map<string, string>; onClose: () => void;
}) {
  const board = circle === 'inner' ? content.board : content.outerBoard;
  const cell = board.cells[index]!;
  const dreams = circle === 'outer' ? content.outerBoard.dreamsAt[index] : undefined;
  const picture = cellArt(cell, index, circle, dreams);
  const here = game.players.filter((p) => shown.get(p.id) === `${circle}:${index}`);
  const title = CELL_TITLES[cell] ?? cell;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // окно выносим в body: на поле есть анимации, внутри которых position: fixed ведёт себя иначе
  return createPortal(
    <div className="overlay toast-in" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`overlay-card cell-info ${cell}`} onClick={(e) => e.stopPropagation()}>
        <div className="cell-info-art">
          {picture ? <img src={art(picture)} alt="" /> : <Icon name={`cell-${cell}`} size={64} />}
        </div>
        <h2><Icon name={`cell-${cell}`} />{title}</h2>
        <p>{cellHelp(cell)}</p>
        {dreams && <p className="cell-info-extra">Мечты на этой клетке: {dreams.map((d) => dreamTitle(d)).join(', ')}.</p>}
        {board.paydayAt.includes(index) && (
          <p className="cell-info-extra"><Icon name="cell-payday" size={16} /> {PAYDAY_HELP[circle]}</p>
        )}
        {here.length > 0 && <p className="cell-info-extra">Сейчас здесь: {here.map((p) => p.name).join(', ')}.</p>}
        <button className="primary" onClick={onClose} autoFocus>Понятно</button>
      </div>
    </div>,
    document.body,
  );
}
