import { content } from '../content.js';
import { outerProgress, passiveIncome, totalExpenses, type GameEvent } from '@kapital/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { art, Icon, playerColor, Token } from '../art.js';
import { describe, money, professionTitle } from '../format.js';
import type { PublicGame, TableApi, View } from '../net.js';
import { Actions } from './Actions.js';
import { Board } from './Board.js';
import { Center } from './Center.js';
import { Stars } from './Campaign.js';
import { goalText, nextLevel } from '../campaign.js';
import { saveStars } from '../campaign-progress.js';
import { levels } from '@kapital/content';
import { Chat } from './Chat.js';
import { LevelChart } from './LevelChart.js';
import { Mentor } from './Mentor.js';
import { ReportQuiz } from './ReportQuiz.js';
import { Statement, type Flash } from './Statement.js';

function useCountdown(deadline: number | null, total: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  // часы клиента и сервера расходятся, поэтому показываем не больше лимита хода
  return deadline ? Math.min(total, Math.max(0, Math.ceil((deadline - now) / 1000))) : null;
}

/** Сумма последнего прихода или расхода игрока: для всплывающей цифры у наличных. */
function lastFlash(log: GameEvent[], start: number, me: string | null): Flash | null {
  for (let i = log.length - 1; i >= Math.max(0, log.length - 12); i--) {
    const e = log[i]!;
    const key = start + i;
    if (!('playerId' in e) || e.playerId !== me) continue;
    if (e.type === 'payday' || e.type === 'income') return { key, amount: e.amount };
    if (e.type === 'paid') return { key, amount: -e.amount };
    if (e.type === 'sold') return { key, amount: e.proceeds };
    if (e.type === 'bought') return { key, amount: -e.price };
    if (e.type === 'loan_taken') return { key, amount: e.amount };
  }
  return null;
}

type Moment = { kind: 'escape' | 'bankrupt'; key: number; playerId: string };

/** Крупные события партии показываем отдельным экраном. */
function useMoment(log: GameEvent[], start: number) {
  const [moment, setMoment] = useState<Moment | null>(null);
  // сквозной номер следующего непросмотренного события
  const seen = useRef(start + log.length);
  useEffect(() => {
    for (let n = Math.max(seen.current, start); n < start + log.length; n++) {
      const e = log[n - start]!;
      if (e.type === 'escaped') setMoment({ kind: 'escape', key: n, playerId: e.playerId });
      if (e.type === 'bankrupt') setMoment({ kind: 'bankrupt', key: n, playerId: e.playerId });
    }
    seen.current = start + log.length;
  }, [log, start]);
  const close = useCallback(() => setMoment(null), []);
  return [moment, close] as const;
}

function Overlay({ picture, title, text, onClose, burst, confetti, autoClose }: {
  picture: string; title: string; text: string; onClose?: () => void; burst?: boolean; confetti?: boolean; autoClose?: boolean;
}) {
  // чужие события не должны надолго закрывать поле
  useEffect(() => {
    if (!autoClose || !onClose) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [autoClose, onClose]);
  return (
    <div className="overlay toast-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`overlay-card${burst ? ' escape-burst' : ''}`}>
        {confetti && (
          <div className="win-confetti" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => <span key={i} className="win-confetti__coin" />)}
          </div>
        )}
        <img src={art(picture)} alt="" />
        <h2>{title}</h2>
        <p>{text}</p>
        {onClose && <button className="primary" onClick={onClose} autoFocus>Продолжить</button>}
      </div>
    </div>
  );
}

function Players({ game, view, me }: { game: PublicGame; view: View; me: string | null }) {
  return (
    <section className="players card">
      <h2>Игроки</h2>
      <ul>
        {game.players.map((p, i) => {
          const seat = view.seats.find((s) => s.id === p.id);
          const pct = p.circle === 'outer'
            ? Math.floor(outerProgress(content, p) * 100)
            : Math.min(100, Math.floor((passiveIncome(content, p) / totalExpenses(content, p)) * 100));
          return (
            <li key={p.id} className={`${i === game.current ? 'current' : ''}${p.circle === 'outer' ? ' outer' : ''}`}>
              <span className="avatar" style={{ borderColor: playerColor(i) }}>
                <img src={art(`professions/${p.professionId}.webp`)} alt="" />
                <Token color={playerColor(i)} />
              </span>
              <span className="who">
                <strong>{p.name}{p.id === me ? ' (вы)' : ''}</strong>
                <span className="muted">
                  {professionTitle(p.professionId)} · {money(p.cash)}
                  {seat?.bot ? ' · бот' : seat && !seat.connected ? ' · отключился' : ''}
                </span>
                <span className={`meter small${p.circle === 'outer' ? ' gold' : ''}`} title={p.circle === 'outer' ? 'Доход к цели' : 'Пассивный доход к расходам'}>
                  <span style={{ width: `${pct}%` }} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Итог уровня «Тренировки»: звёзды и переход к следующему. */
function LevelResult({ api, view, onTraining, history }: { api: TableApi; view: View; onTraining: () => void; history: (number | undefined)[] }) {
  const lv = view.level!;
  const level = levels.find((l) => l.id === lv.id)!;
  const result = lv.result!;
  const next = nextLevel(level.id);
  useEffect(() => {
    if (result.passed) saveStars(level.id, result.stars);
  }, [level.id, result]);
  const play = (id: string) => {
    api.leave();
    api.startLevel(id);
  };
  return (
    <div className="overlay toast-in" role="dialog" aria-modal="true" aria-label={result.passed ? 'Уровень пройден' : 'Уровень не пройден'}>
      <div className="overlay-card level-result">
        {result.passed && (
          <div className="level-complete-confetti" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => <span key={i} className="level-complete-confetti__piece" />)}
          </div>
        )}
        <img src={art(result.passed ? 'campaign/level-complete.webp' : 'campaign/level-failed.webp')} alt="" />
        <h2>{result.passed ? `«${level.title}» пройден!` : 'Ходы закончились'}</h2>
        {result.passed ? (
          <>
            <Stars n={result.stars} />
            <p>Цель выполнена за {result.turns} ходов. {result.stars < 3 ? `Три звезды — за ${level.stars[0]} ходов.` : 'Лучший результат.'}</p>
          </>
        ) : (
          <p>Цель: {goalText(level)}. Попробуйте ещё раз: вкладывайте раньше и следите за потоком.</p>
        )}
        {history.some((v) => v !== undefined) && <LevelChart level={level} mine={history} />}
        <div className="row wrap center">
          {result.passed && next && <button className="primary" autoFocus onClick={() => play(next.id)}>Следующий уровень</button>}
          {result.passed && result.stars < 3 && <button onClick={() => play(level.id)}>Повторить и улучшить</button>}
          {!result.passed && <button className="primary" autoFocus onClick={() => play(level.id)}>Ещё раз</button>}
          <button className="ghost" onClick={onTraining}>К уровням</button>
        </div>
      </div>
    </div>
  );
}

interface LevelTrack { level: string | null; points: (number | undefined)[] }
const TRACK_KEY = 'kapital:level-track';

function loadTrack(): LevelTrack {
  try {
    const raw = JSON.parse(localStorage.getItem(TRACK_KEY) ?? 'null') as { level: string; points: (number | null)[] } | null;
    if (raw && typeof raw.level === 'string' && Array.isArray(raw.points)) {
      return { level: raw.level, points: raw.points.map((v) => (typeof v === 'number' ? v : undefined)) };
    }
  } catch { /* хранилище недоступно — начнём заново */ }
  return { level: null, points: [] };
}

function saveTrack(track: LevelTrack) {
  try {
    localStorage.setItem(TRACK_KEY, JSON.stringify(track));
  } catch { /* не страшно: график начнётся заново после перезагрузки */ }
}

type MobileTab = 'turn' | 'money' | 'players' | 'chat';
const MOBILE_TABS: [MobileTab, string, string][] = [
  ['turn', 'Ход', 'ui-dice'],
  ['money', 'Финансы', 'ui-wallet'],
  ['players', 'Игроки', 'ui-family'],
  ['chat', 'Чат', 'ui-chat'],
];

function LevelGoal({ view, history }: { view: View; history: (number | undefined)[] }) {
  const level = levels.find((l) => l.id === view.level!.id)!;
  const pct = Math.floor(view.level!.share * 100);
  return (
    <section className="level-goal card">
      <span className="muted">{level.title}</span>
      <strong>Цель: {goalText(level)}</strong>
      <div className="meter gold" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Цель выполнена на ${pct}%`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {history.some((v) => v !== undefined) && <LevelChart level={level} mine={history} live />}
    </section>
  );
}

export function Game({ api, view, onTraining }: { api: TableApi; view: View; onTraining: () => void }) {
  const game = view.game!;
  const me = game.players.find((p) => p.id === api.me);
  const seconds = useCountdown(view.turnDeadline, view.turnSeconds);
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? id;
  const anyOuter = game.players.some((p) => p.circle === 'outer');
  const logRef = useRef<HTMLOListElement>(null);
  const [moment, closeMoment] = useMoment(api.log, api.logStart);
  const [winSeen, setWinSeen] = useState(false);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [api.log.length]);

  const center = <Center api={api} game={game} seconds={seconds} deadline={view.turnDeadline} turnSeconds={view.turnSeconds} />;
  // карта и кубик — на поле того, кто сейчас ходит; поле показываем одно, второе — по переключателю
  const turnCircle = game.players[game.current]!.circle;
  const [pinned, setPinned] = useState<'inner' | 'outer' | null>(null);
  const shownCircle = anyOuter ? pinned ?? turnCircle : 'inner';
  const onCircle = (c: 'inner' | 'outer') => game.players.filter((p) => p.circle === c).length;
  const winner = game.winnerId ? game.players.find((p) => p.id === game.winnerId) : null;
  // для графика уровня: выполнение цели к концу каждого хода, переживает перезагрузку страницы
  const [track, setTrack] = useState<LevelTrack>(loadTrack);
  const levelId = view.level?.id ?? null;
  const levelShare = view.level?.share;
  const myTurns = me?.turnsTaken;
  useEffect(() => {
    if (levelShare === undefined || myTurns === undefined) return;
    setTrack((t) => {
      // новый уровень или тот же уровень заново — начинаем историю сначала
      const restarted = myTurns === 0 && t.points.length > 1;
      const points = t.level === levelId && !restarted ? t.points : [];
      if (points === t.points && points[myTurns] === levelShare) return t;
      const next = [...points];
      next[myTurns] = levelShare;
      const track = { level: levelId, points: next };
      saveTrack(track);
      return track;
    });
  }, [levelId, levelShare, myTurns]);
  const history = track.level === levelId ? track.points : [];
  // на телефоне партия разбита на вкладки, панель хода видна на всех
  const [mtab, setMtab] = useState<MobileTab>('turn');

  return (
    <main className="game" data-mtab={mtab}>
      {view.level?.result && <LevelResult api={api} view={view} onTraining={onTraining} history={history} />}
      {game.status === 'finished' && !winSeen && !view.level && (
        <Overlay
          picture={winner ? 'screens/win.webp' : 'screens/time-up.webp'}
          confetti={!!winner}
          title={winner ? (winner.id === api.me ? 'Вы победили!' : `Победил ${winner.name}`) : 'Партия окончена'}
          text={winner ? `${winner.name} ${winner.wonAtTurn ? `на ${winner.wonAtTurn}-м ходу ` : ''}добился финансовой свободы.` : `За ${content.rules.maxTurns} ходов никто не дошёл до цели. Попробуйте ещё раз: вкладывайте раньше и держите кредит под контролем.`}
          onClose={() => setWinSeen(true)}
        />
      )}
      {moment?.kind === 'escape' && game.status === 'playing' && (
        <Overlay
          key={moment.key}
          picture="screens/escape.webp"
          burst
          autoClose={moment.playerId !== api.me}
          title={moment.playerId === api.me ? 'Вы на «Свободном пути»!' : `${name(moment.playerId)} на «Свободном пути»`}
          text="Пассивный доход покрыл расходы. Теперь цель — накопить на мечту и купить её на своей клетке."
          onClose={closeMoment}
        />
      )}
      {moment?.kind === 'bankrupt' && game.status === 'playing' && (
        <Overlay
          key={moment.key}
          picture="screens/bankrupt.webp"
          autoClose={moment.playerId !== api.me}
          title={moment.playerId === api.me ? 'Банкротство' : `${name(moment.playerId)} банкротится`}
          text="Активы распроданы, кредит банка списан, на руках снова стартовые деньги профессии. Игра продолжается."
          onClose={closeMoment}
        />
      )}
      <div className="boards" data-pane="turn">
        {anyOuter && (
          <div className="board-switch" role="tablist" aria-label="Какое поле показать">
            {(['inner', 'outer'] as const).map((c) => (
              <button
                key={c} role="tab" aria-selected={shownCircle === c} className={shownCircle === c ? 'active' : ''}
                onClick={() => setPinned(c === turnCircle ? null : c)}
              >
                {c === 'inner' ? 'Круг забот' : 'Свободный путь'} · {onCircle(c)}
                {turnCircle === c && <span className="dot" aria-label="сейчас ходят здесь" />}
              </button>
            ))}
          </div>
        )}
        <Board key={shownCircle} game={game} circle={shownCircle} center={turnCircle === shownCircle ? center : <span className="board-label">{shownCircle === 'inner' ? 'Круг забот' : 'Свободный путь'}</span>} />
      </div>
      <aside className="side">
        {view.level && <LevelGoal view={view} history={history} />}
        {me && game.status === 'playing' && <Actions api={api} game={game} me={me} reaction={view.reaction} seconds={seconds} />}
        <div className="pane" data-pane="turn">
          {me && <Mentor game={game} me={me} />}
          <ReportQuiz log={api.log} logStart={api.logStart} me={api.me} />
        </div>
        {me && <div data-pane="money" className={moment?.kind === 'bankrupt' && moment.playerId === me.id ? 'pane bankrupt-shake' : 'pane'}><Statement p={me} flash={lastFlash(api.log, api.logStart, api.me)} /></div>}
        <div className="pane" data-pane="players"><Players game={game} view={view} me={api.me} /></div>
        <div className="pane" data-pane="chat"><Chat api={api} view={view} /></div>
        <section className="log card" data-pane="players">
          <h2><Icon name="ui-chat" size={16} />Журнал</h2>
          <ol ref={logRef}>
            {api.log.map((e, i) => {
              const text = describe(e, name);
              return text ? <li key={api.logStart + i} className={`ev-${e.type}`}>{text}</li> : null;
            })}
          </ol>
        </section>
        <button className="ghost leave" data-pane="players" onClick={view.level ? onTraining : api.leave}>
          <Icon name="ui-exit" />
          {view.level ? 'К уровням' : game.status === 'playing' ? 'В кабинет: партия сохранится' : 'В кабинет'}
        </button>
      </aside>
      <nav className="bottom-nav game-tabs" aria-label="Разделы партии">
        {MOBILE_TABS.map(([id, title, icon]) => (
          <button key={id} aria-current={mtab === id ? 'page' : undefined} onClick={() => { setMtab(id); window.scrollTo({ top: 0 }); }}>
            <Icon name={icon} size={20} />{title}
          </button>
        ))}
      </nav>
    </main>
  );
}
