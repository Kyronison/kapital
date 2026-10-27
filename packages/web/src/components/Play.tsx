import { levels } from '@kapital/content';
import { useEffect, useState, type ReactNode } from 'react';
import { art, Icon } from '../art.js';
import { hideSave, listSaves } from '../auth.js';
import { currentLevel, goalText } from '../campaign.js';
import { useProgress } from '../campaign-progress.js';
import { content } from '../content.js';
import { professionTitle } from '../format.js';
import { go } from '../nav.js';
import type { SaveSummary, TableApi } from '../net.js';
import { useRating } from '../rating.js';

const nf = new Intl.NumberFormat('ru-RU');

const when = (t: number) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * «Играть» — первый экран после входа. Сверху одно главное действие по ситуации:
 * незаконченная партия, первый уровень для новичка или следующий уровень «Тренировки».
 */
export function Play({ api, name }: { api: TableApi; name: string }) {
  const roomId = new URLSearchParams(location.search).get('room');
  const [saves, setSaves] = useState<SaveSummary[] | null>(null);
  const progress = useProgress();
  const rating = useRating();

  // незаконченные партии лежат в аккаунте: список один на все устройства
  useEffect(() => {
    listSaves().then(setSaves).catch(() => setSaves([]));
  }, []);

  if (roomId) return <Invited api={api} roomId={roomId} name={name} />;

  const level = currentLevel(progress);
  const stars = Object.values(progress).reduce((a, b) => a + b, 0);
  const newbie = stars === 0 && (rating?.me.games ?? 0) === 0;
  const [latest, ...older] = saves ?? [];
  const hide = (saveId: string) => {
    void hideSave(saveId).catch(() => undefined);
    setSaves((saves ?? []).filter((s) => s.saveId !== saveId));
  };

  return (
    <div className="play">
      {saves === null ? <section className="card play-hero placeholder" aria-busy="true" />
        : latest ? (
          <section className="card play-hero">
            <img className="play-hero-art" src={art('screens/continue.webp')} alt="" />
            <div>
              <span className="eyebrow">Партия ждёт вас</span>
              <h1>Продолжить партию</h1>
              <p className="muted">
                {latest.players.join(', ')} · {latest.mode === 'quick' ? 'быстрая' : 'классика'} · ход {latest.turn} · {when(latest.savedAt)}
              </p>
              <div className="row wrap">
                <button className="primary big kap-button" onClick={() => api.resume(latest.saveId)}><Icon name="ui-continue" />Продолжить</button>
                <button className="ghost" onClick={() => hide(latest.saveId)}>Убрать из списка</button>
              </div>
            </div>
          </section>
        ) : (
          <section className="card play-hero">
            <img className="play-hero-art" src={art(`professions/${level.professionId}.webp`)} alt="" />
            <div>
              <span className="eyebrow">{newbie ? 'С чего начать' : `Тренировка · уровень ${levels.indexOf(level) + 1} из ${levels.length}`}</span>
              <h1>{newbie ? 'Сыграйте первый уровень' : level.title}</h1>
              <p className="muted">
                {newbie
                  ? 'Пять минут, одна профессия и простая цель. Наставник подскажет, что делать на каждом шаге.'
                  : `${professionTitle(level.professionId)}: ${goalText(level)}.`}
              </p>
              <div className="row wrap">
                <button className="primary big kap-button" onClick={() => api.startLevel(level.id)}>
                  <Icon name="ui-level" />
                  {newbie ? 'Начать обучение' : progress[level.id] ? 'Пройти ещё раз' : 'Играть уровень'}
                </button>
                <button className="ghost" onClick={() => go('training')}>Все уровни</button>
              </div>
            </div>
          </section>
        )}

      <div className="play-grid">
        <NewTable api={api} />

        <section className="card play-card">
          <h2><Icon name="ui-link" size={18} />Сесть за стол друга</h2>
          <p className="muted">Друг создал стол и прислал ссылку? Вставьте её сюда или просто откройте.</p>
          <JoinByLink />
        </section>

        {latest && (
          <section className="card play-card">
            <h2><Icon name="ui-level" size={18} />Тренировка</h2>
            <p><strong>Уровень {levels.indexOf(level) + 1}. {level.title}</strong></p>
            <p className="muted">{goalText(level)}. Звёзд: {stars} из {levels.length * 3}.</p>
            <button className="kap-button" onClick={() => api.startLevel(level.id)}><Icon name="ui-level" />Играть уровень</button>
          </section>
        )}

        {older.length > 0 && (
          <section className="card play-card saves">
            <h2><Icon name="ui-archive" size={18} />Другие незаконченные партии</h2>
            <ul>
              {older.map((x) => (
                <li key={x.saveId}>
                  <span>
                    <strong>{x.players.join(', ')}</strong>
                    <small className="muted">{x.mode === 'quick' ? 'Быстрая' : 'Классика'} · ход {x.turn} · {when(x.savedAt)}</small>
                  </span>
                  <button className="primary" onClick={() => api.resume(x.saveId)}><Icon name="ui-continue" size={16} />Продолжить</button>
                  <button className="ghost" aria-label="Убрать из списка" title="Убрать из списка" onClick={() => hide(x.saveId)}>×</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** Новый стол: профессия и мечта по умолчанию случайные, выбор спрятан, чтобы не пугать с порога. */
function NewTable({ api }: { api: TableApi }) {
  const [professionId, setProfessionId] = useState('');
  const [dreamId, setDreamId] = useState('');
  return (
    <section className="card play-card new-table">
      <h2><Icon name="ui-dice" size={18} />Новая партия</h2>
      <p className="muted">Стол на 1–6 игроков: позовите друзей по ссылке или добавьте ботов. Режим и время на ход выберете за столом.</p>
      <Pickers professionId={professionId} dreamId={dreamId} onProfession={setProfessionId} onDream={setDreamId} />
      <button className="primary big kap-button" onClick={() => api.create({ professionId: professionId || undefined, dreamId: dreamId || undefined })}>
        <Icon name="ui-dice" />
        Создать стол
      </button>
    </section>
  );
}

function JoinByLink() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const join = () => {
    const raw = text.trim();
    let id: string | null = null;
    try {
      id = new URL(raw).searchParams.get('room');
    } catch {
      id = /^[A-Za-z0-9_-]{4,64}$/.test(raw) ? raw : null;
    }
    if (!id) return setError('Не похоже на приглашение: нужна ссылка вида …?room=abc123');
    location.search = `?room=${encodeURIComponent(id)}`;
  };
  return (
    <form className="join-link" onSubmit={(e) => { e.preventDefault(); join(); }}>
      <input value={text} onChange={(e) => { setText(e.target.value); setError(null); }} placeholder="Ссылка-приглашение или код стола" aria-label="Ссылка-приглашение" />
      <button className="kap-button" type="submit" disabled={!text.trim()}>Войти</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

/** По ссылке-приглашению: только выбор профессии и мечты и кнопка «Сесть за стол». */
function Invited({ api, roomId, name }: { api: TableApi; roomId: string; name: string }) {
  const [professionId, setProfessionId] = useState('');
  const [dreamId, setDreamId] = useState('');
  return (
    <div className="play">
      <section className="card play-hero invited">
        <img className="play-hero-art" src={art('screens/waiting.webp')} alt="" />
        <div>
          <span className="eyebrow">Приглашение</span>
          <h1>Вас пригласили за стол</h1>
          <p className="muted">За стол садится <strong>{name}</strong>. Профессию и мечту можно оставить случайными.</p>
          <Pickers professionId={professionId} dreamId={dreamId} onProfession={setProfessionId} onDream={setDreamId} />
          <div className="row wrap">
            <button className="primary big kap-button" onClick={() => api.join(roomId, { professionId: professionId || undefined, dreamId: dreamId || undefined })}>
              Сесть за стол
            </button>
            <button className="ghost" onClick={() => (location.href = location.pathname)}>Не сейчас</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Pickers({ professionId, dreamId, onProfession, onDream }: {
  professionId: string; dreamId: string; onProfession: (id: string) => void; onDream: (id: string) => void;
}) {
  const summary = `Профессия: ${professionId ? professionTitle(professionId) : 'случайная'} · мечта: ${dreamId ? content.dreams.find((d) => d.id === dreamId)?.title : 'случайная'}`;
  return (
    <details className="pickers">
      <summary>{summary}<span className="link">Выбрать</span></summary>
      <fieldset>
        <legend>Профессия</legend>
        <div className="picker professions">
          <Choice checked={professionId === ''} onPick={() => onProfession('')} group="profession" label="Случайная">
            <span className="random"><Icon name="ui-dice" size={32} /></span>
            <strong>Случайная</strong>
          </Choice>
          {content.professions.map((p) => (
            <Choice key={p.id} checked={professionId === p.id} onPick={() => onProfession(p.id)} group="profession" label={p.title}>
              <img src={art(`professions/${p.id}.webp`)} alt="" loading="lazy" />
              <strong>{p.title}</strong>
              <small>{nf.format(p.salary)} К</small>
            </Choice>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Мечта</legend>
        <div className="picker dreams">
          <Choice checked={dreamId === ''} onPick={() => onDream('')} group="dream" label="Случайная">
            <span className="random"><Icon name="cell-dream" size={32} /></span>
            <strong>Случайная</strong>
          </Choice>
          {content.dreams.map((d) => (
            <Choice key={d.id} checked={dreamId === d.id} onPick={() => onDream(d.id)} group="dream" label={d.title}>
              <img src={art(`dreams/${d.id}.webp`)} alt="" loading="lazy" />
              <strong>{d.title}</strong>
            </Choice>
          ))}
        </div>
      </fieldset>
    </details>
  );
}

function Choice({ checked, onPick, group, label, children }: {
  checked: boolean; onPick: () => void; group: string; label: string; children: ReactNode;
}) {
  return (
    <label className={`choice${checked ? ' checked' : ''}`}>
      <input type="radio" name={group} checked={checked} onChange={onPick} aria-label={label} />
      {children}
    </label>
  );
}
