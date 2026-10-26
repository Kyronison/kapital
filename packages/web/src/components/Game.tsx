import { defaultContent as content } from '@kapital/content';
import { passiveIncome, totalExpenses } from '@kapital/engine';
import { useEffect, useRef, useState } from 'react';
import { describe, money, professionTitle } from '../format.js';
import type { TableApi, View } from '../net.js';
import { Actions, PendingCard } from './Actions.js';
import { Board, PLAYER_COLORS } from './Board.js';
import { Statement } from './Statement.js';

/** Совпадает с turnSeconds сервера по умолчанию. */
const TURN_SECONDS = 30;

function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  // часы клиента и сервера расходятся, поэтому показываем не больше лимита хода
  return deadline ? Math.min(TURN_SECONDS, Math.max(0, Math.ceil((deadline - now) / 1000))) : null;
}

export function Game({ api, view }: { api: TableApi; view: View }) {
  const game = view.game!;
  const me = game.players.find((p) => p.id === api.me);
  const seconds = useCountdown(view.turnDeadline);
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? id;
  const anyOuter = game.players.some((p) => p.circle === 'outer');
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [api.log.length]);

  const center = (
    <>
      <PendingCard game={game} />
      {seconds !== null && game.status === 'playing' && <div className="timer">{seconds} с</div>}
    </>
  );

  return (
    <main className="game">
      {game.status === 'finished' && (
        <div className="winner card">
          {game.winnerId ? `Победил ${name(game.winnerId)}!` : 'Партия окончена по лимиту ходов'}
        </div>
      )}
      <div className="boards">
        <Board game={game} circle="inner" center={center} />
        {anyOuter && <Board game={game} circle="outer" center={<span className="muted">Свободный путь</span>} />}
      </div>
      <aside className="side">
        {me && game.status === 'playing' && <Actions api={api} game={game} me={me} />}
        {me && <Statement p={me} />}
        <section className="players card">
          <h2>Игроки</h2>
          <ul>
            {game.players.map((p, i) => {
              const seat = view.seats.find((s) => s.id === p.id);
              const progress = p.circle === 'outer'
                ? `доход ${money(p.outerIncome)}`
                : `покрыто ${Math.min(100, Math.round((passiveIncome(p) / totalExpenses(content, p)) * 100))}%`;
              return (
                <li key={p.id} className={i === game.current ? 'current' : ''}>
                  <span className="token" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                  <strong>{p.name}</strong>
                  <span className="muted">
                    {professionTitle(p.professionId)} · {money(p.cash)} · {progress}
                    {seat?.bot ? ' · бот' : seat && !seat.connected ? ' · отключился' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="log card">
          <h2>Журнал</h2>
          <ol ref={logRef}>
            {api.log.map((e, i) => {
              const text = describe(e, name);
              return text ? <li key={i}>{text}</li> : null;
            })}
          </ol>
        </section>
      </aside>
    </main>
  );
}
