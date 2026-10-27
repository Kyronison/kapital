import { levels } from '@kapital/content';
import { RATING_RULES, type RatingBoard, type RatingRow } from '@kapital/protocol';
import { useState } from 'react';
import { art, Icon } from '../art.js';
import { go } from '../nav.js';
import { useRating } from '../rating.js';
import { Avatar } from './Shell.js';

const month = (t: number) => new Date(t).toLocaleString('ru-RU', { month: 'long', timeZone: 'Europe/Moscow' });

/**
 * Рейтинг из двух таблиц. «Тренировка» — лучшие звёзды. «Партии» — сколько разных соперников
 * игрок победил за месяц: так очки не накрутить ни договорными победами, ни числом партий.
 */
export function RatingPage() {
  const rating = useRating();
  const [view, setView] = useState<'training' | 'games' | null>(null);
  if (!rating) return <section className="card rating" aria-busy="true"><p className="muted">Загружаем рейтинг…</p></section>;
  const shown = view ?? (rating.games.me.place ? 'games' : 'training');
  const { training, games } = rating;
  const left = Math.max(0, RATING_RULES.qualifyGames - games.counted);

  return (
    <div className="rating">
      <h1 className="page-title">Рейтинг</h1>
      <div className="segmented" role="tablist" aria-label="Таблица">
        <button role="tab" aria-selected={shown === 'training'} onClick={() => setView('training')}><Icon name="ui-level" size={18} />Тренировка</button>
        <button role="tab" aria-selected={shown === 'games'} onClick={() => setView('games')}><Icon name="ui-dice" size={18} />Партии</button>
      </div>

      {shown === 'training' ? (
        <>
          <MyPlace
            board={training}
            title={training.me.place ? `${training.me.place} место из ${training.players}` : 'Пока без места'}
            text={training.me.place
              ? `Звёзд: ${training.me.value} из ${levels.length * 3}. Перепройдите уровни быстрее, чтобы подняться.`
              : 'Пройдите первый уровень «Тренировки», чтобы попасть в таблицу.'}
            action={!training.me.place ? <button className="primary kap-button" onClick={() => go('training')}><Icon name="ui-level" />К тренировке</button> : null}
          />
          <Table board={training} unit="★" empty="В таблице пока никого. Первое место ждёт того, кто первым пройдёт уровень." />
          <section className="card rating-rules">
            <h2><Icon name="ui-hint" size={18} />Как считается</h2>
            <ul>
              <li>Сумма лучших звёзд по всем уровням, максимум {levels.length * 3}. Перепрохождение добавляет только разницу.</li>
              <li>Звёзды начисляет сервер по итогу уровня.</li>
              <li>У игроков с одинаковыми звёздами одно место.</li>
            </ul>
          </section>
        </>
      ) : (
        <>
          <MyPlace
            board={games}
            title={games.me.place ? `${games.me.place} место из ${games.players}` : left > 0 ? 'Предварительно' : 'Пока без места'}
            text={left > 0
              ? `Сыграно ${games.counted} из ${RATING_RULES.qualifyGames} зачётных партий. Место появится после ещё ${left}.`
              : games.me.place
                ? `В ${month(games.since)} вы победили разных соперников: ${games.me.value}.`
                : `Победите в зачётной партии в ${month(games.since)}, чтобы попасть в таблицу.`}
            action={null}
          />
          <Table board={games} unit="соп." empty={`В ${month(games.since)} в таблице пока никого. Соберите стол из трёх и больше друзей.`} />
          <section className="card rating-rules">
            <h2><Icon name="ui-hint" size={18} />Как считается</h2>
            <ul>
              <li>Очко — каждый <strong>новый</strong> соперник, которого вы победили в этом месяце. Один и тот же соперник даёт не больше одного очка в месяц.</li>
              <li>Зачётная партия — от {RATING_RULES.minHumans} до 6 человек (боты не считаются), доигранная до конца.</li>
              <li>Место в таблице появляется после {RATING_RULES.qualifyGames} зачётных партий с любым исходом.</li>
              <li>Таблица обнуляется в начале каждого месяца по Москве. У игроков с равным счётом одно место.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function MyPlace({ board, title, text, action }: { board: RatingBoard; title: string; text: string; action: React.ReactNode }) {
  return (
    <section className="card rating-me">
      <span className="rating-place">{board.me.place ?? '—'}</span>
      <div>
        <span className="eyebrow">Ваше место</span>
        <h2 className="rating-me-title">{title}</h2>
        <p className="muted">{text}</p>
      </div>
      {action}
    </section>
  );
}

function Table({ board, unit, empty }: { board: RatingBoard; unit: string; empty: string }) {
  const { top, me } = board;
  if (top.length === 0) {
    return (
      <section className="card empty">
        <img src={art('screens/archive-empty.webp')} alt="" />
        <p>{empty}</p>
      </section>
    );
  }
  return (
    <section className="card">
      <ol className="rating-list">
        {top.map((r) => <Row key={r.userId} r={r} unit={unit} mine={r.userId === me.userId} />)}
        {me.place && !top.some((r) => r.userId === me.userId) && <Row r={me} unit={unit} mine />}
      </ol>
    </section>
  );
}

function Row({ r, unit, mine }: { r: RatingRow; unit: string; mine: boolean }) {
  return (
    <li className={`rating-row${mine ? ' mine' : ''}${r.place === 1 ? ' p1' : ''}`}>
      <span className="place">{r.place}</span>
      <span className="who"><Avatar name={r.name} size={28} /><strong>{r.name}</strong>{mine && <span className="badge">вы</span>}</span>
      <span className="points">{r.value} <small className="muted">{unit}</small></span>
    </li>
  );
}
