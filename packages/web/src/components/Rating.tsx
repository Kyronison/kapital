import { RATING_POINTS, type PlayerStats } from '@kapital/protocol';
import { art, Icon } from '../art.js';
import { go } from '../nav.js';
import { useRating } from '../rating.js';
import { Avatar } from './Shell.js';

const nf = new Intl.NumberFormat('ru-RU');

/** Рейтинг игроков: своя строка всегда на виду, ниже — таблица лучших. */
export function RatingPage() {
  const rating = useRating();
  if (!rating) return <section className="card rating" aria-busy="true"><p className="muted">Загружаем рейтинг…</p></section>;
  const { me, top, players } = rating;

  return (
    <div className="rating">
      <section className="card rating-me">
        <span className="rating-place">{me.place ?? '—'}</span>
        <div>
          <span className="eyebrow">Ваше место</span>
          <h1>{me.place ? `${me.place} из ${players}` : 'Пока без места'}</h1>
          <p className="muted">
            {me.place
              ? `${nf.format(me.points)} очков: звёзд ${me.stars}, побед ${me.wins}, партий ${me.games}.`
              : 'Пройдите уровень «Тренировки» или доиграйте партию, чтобы попасть в рейтинг.'}
          </p>
        </div>
        {!me.place && <button className="primary kap-button" onClick={() => go('training')}><Icon name="ui-level" />К тренировке</button>}
      </section>

      <section className="card">
        <h2><Icon name="ui-trophy" size={18} />Лучшие игроки</h2>
        {top.length === 0 ? (
          <div className="empty">
            <img src={art('screens/archive-empty.webp')} alt="" />
            <p>В рейтинге пока никого. Первое место ждёт того, кто первым пройдёт уровень или доиграет партию.</p>
          </div>
        ) : (
          <ol className="rating-list">
            <li className="rating-row head" aria-hidden="true">
              <span>#</span><span>Игрок</span><span>★</span><span>Победы</span><span>Партии</span><span>Очки</span>
            </li>
            {top.map((r) => <Row key={r.userId} r={r} mine={r.userId === me.userId} />)}
            {me.place && !top.some((r) => r.userId === me.userId) && <Row r={me} mine />}
          </ol>
        )}
      </section>

      <section className="card rating-rules">
        <h2><Icon name="ui-hint" size={18} />Как набрать очки</h2>
        <ul>
          <li><strong>{RATING_POINTS.star}</strong> за каждую звезду «Тренировки» (считается лучший результат уровня)</li>
          <li><strong>{RATING_POINTS.winVsPeople}</strong> за победу за столом, где были другие люди</li>
          <li><strong>{RATING_POINTS.winVsBots}</strong> за победу только над ботами</li>
          <li><strong>{RATING_POINTS.game}</strong> за каждую доигранную партию</li>
        </ul>
      </section>
    </div>
  );
}

function Row({ r, mine }: { r: PlayerStats; mine: boolean }) {
  return (
    <li className={`rating-row${mine ? ' mine' : ''}${r.place && r.place <= 3 ? ` podium p${r.place}` : ''}`}>
      <span className="place">{r.place}</span>
      <span className="who"><Avatar name={r.name} size={28} /><strong>{r.name}</strong>{mine && <span className="badge">вы</span>}</span>
      <span>{r.stars}</span>
      <span>{r.wins}</span>
      <span>{r.games}</span>
      <span className="points">{nf.format(r.points)}</span>
    </li>
  );
}
