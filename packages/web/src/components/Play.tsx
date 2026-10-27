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
import { Avatar } from './Shell.js';

const nf = new Intl.NumberFormat('ru-RU');

const when = (t: number) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Брошенная давно партия не становится главным действием, она просто лежит в списке. */
const FRESH_MS = 7 * 24 * 3600_000;

type Saves = { status: 'loading' } | { status: 'error' } | { status: 'ok'; list: SaveSummary[] };

/**
 * «Играть» — первый экран после входа. Сверху одно главное действие по сценарию:
 * новичок начинает первую тренировку, вернувшийся возвращается в партию или продолжает уровни.
 * Вторая кнопка всегда «Создать игру с друзьями», чтобы обе были видны на первом экране телефона.
 */
export function Play({ api, name }: { api: TableApi; name: string }) {
  const roomId = new URLSearchParams(location.search).get('room');
  const [saves, setSaves] = useState<Saves>({ status: 'loading' });
  const progress = useProgress();
  const rating = useRating();

  // незаконченные партии лежат в аккаунте: список один на все устройства
  const load = () => {
    setSaves({ status: 'loading' });
    listSaves().then((list) => setSaves({ status: 'ok', list })).catch(() => setSaves({ status: 'error' }));
  };
  useEffect(load, []);

  if (roomId) return <Invited api={api} roomId={roomId} name={name} />;

  const level = currentLevel(progress);
  const passed = Object.keys(progress).length;
  const list = saves.status === 'ok' ? saves.list : [];
  const fresh = list[0] && Date.now() - list[0].savedAt < FRESH_MS ? list[0] : null;
  const others = fresh ? list.slice(1) : list;
  const newbie = passed === 0 && (rating?.stats.games ?? 0) === 0 && list.length === 0;
  const hide = (saveId: string) => {
    void hideSave(saveId).catch(() => undefined);
    setSaves({ status: 'ok', list: list.filter((s) => s.saveId !== saveId) });
  };

  return (
    <div className="play">
      <h1 className="page-title">Играть</h1>
      {saves.status === 'error' && (
        <section className="card play-card load-error" role="alert">
          <p><strong>Не удалось загрузить ваши партии.</strong> Проверьте интернет и попробуйте ещё раз.</p>
          <button className="kap-button" onClick={load}>Повторить</button>
        </section>
      )}
      {saves.status === 'loading' ? <section className="card play-hero placeholder" aria-busy="true" />
        : newbie ? (
          <section className="card play-hero">
            <img className="play-hero-art" src={art('cabinet/play-first-level.webp')} alt="" />
            <div>
              <span className="eyebrow">Добро пожаловать</span>
              <h2 className="hero-title">Начните играть в «Капитал»</h2>
              <p className="muted">Попробуйте одиночную тренировку: наставник подскажет каждый шаг. Или пригласите друзей в игру для 2–6 человек.</p>
              <div className="row wrap">
                <button className="primary big kap-button" onClick={() => api.startLevel(level.id)}><Icon name="ui-level" />Начать первую тренировку</button>
                <button className="kap-button" onClick={() => api.create({})}><Icon name="ui-dice" />Создать игру с друзьями</button>
              </div>
              <Invite />
            </div>
          </section>
        ) : (
          <div className="play-columns">
            <div className="play-main">
              {fresh && (
                <section className="card play-game">
                  <img className="play-card-art" src={art('cabinet/play-continue.webp')} alt="" />
                  <span className="eyebrow">Ваша незаконченная партия</span>
                  <ul className="play-players">
                    {fresh.players.map((p, i) => <li key={i}><Avatar name={p} size={32} /><span>{p}</span></li>)}
                  </ul>
                  <p className="muted">Игра идёт · ход {fresh.turn} · {fresh.mode === 'quick' ? 'быстрая' : 'классика'} · {when(fresh.savedAt)}</p>
                  <button className="primary big kap-button wide" onClick={() => api.resume(fresh.saveId)}><Icon name="ui-continue" />Вернуться в партию</button>
                </section>
              )}
              <NewGame api={api} />
              {others.length > 0 && (
                <section className="card play-card saves">
                  <h2><Icon name="ui-archive" size={18} />{fresh ? 'Другие незаконченные партии' : 'Незаконченные партии'}</h2>
                  <ul>
                    {others.map((x) => (
                      <li key={x.saveId}>
                        <span>
                          <strong>{x.players.join(', ')}</strong>
                          <small className="muted">{x.mode === 'quick' ? 'Быстрая' : 'Классика'} · ход {x.turn} · {when(x.savedAt)}</small>
                        </span>
                        <button className="kap-button" onClick={() => api.resume(x.saveId)}><Icon name="ui-continue" size={16} />Продолжить</button>
                        <button className="ghost" aria-label="Убрать из списка" title="Убрать из списка" onClick={() => hide(x.saveId)}>×</button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <aside className="play-side">
              <section className="card play-card training-card">
                <h2><Icon name="ui-level" size={18} />Продолжите тренировку</h2>
                <p><strong>Пройдено {passed} из {levels.length} уровней</strong></p>
                <div className="meter gold" role="progressbar" aria-valuemin={0} aria-valuemax={levels.length} aria-valuenow={passed} aria-label={`Пройдено ${passed} из ${levels.length}`}>
                  <span style={{ width: `${(passed / levels.length) * 100}%` }} />
                </div>
                <p className="muted">Далее — уровень {levels.indexOf(level) + 1}: «{level.title}». {professionTitle(level.professionId)}, {goalText(level)}.</p>
                <button className={`${fresh ? '' : 'primary '}kap-button wide`} onClick={() => api.startLevel(level.id)}>
                  <Icon name="ui-level" />
                  Начать уровень {levels.indexOf(level) + 1}
                </button>
                <button className="link" onClick={() => go('training')}>Все уровни</button>
              </section>
            </aside>
          </div>
        )}
    </div>
  );
}

/** «Есть приглашение?»: поле вставки ссылки открывается по нажатию. */
function Invite() {
  const [open, setOpen] = useState(false);
  return open ? <JoinByLink /> : <button className="link invite-link" onClick={() => setOpen(true)}>Есть приглашение?</button>;
}

/** Новая игра с друзьями: профессия и мечта по умолчанию случайные, выбор свёрнут. */
function NewGame({ api }: { api: TableApi }) {
  const [professionId, setProfessionId] = useState('');
  const [dreamId, setDreamId] = useState('');
  return (
    <section className="card play-card new-table">
      <img className="play-card-art wide-art" src={art('cabinet/play-friends.webp')} alt="" />
      <h2><Icon name="ui-dice" size={18} />Новая игра с друзьями</h2>
      <p className="muted">2–6 игроков · приглашение по ссылке · пустые места можно занять ботами</p>
      <Pickers professionId={professionId} dreamId={dreamId} onProfession={setProfessionId} onDream={setDreamId} />
      <div className="row wrap">
        <button className="kap-button" onClick={() => api.create({ professionId: professionId || undefined, dreamId: dreamId || undefined })}>
          <Icon name="ui-dice" />
          Создать игру
        </button>
      </div>
      <Invite />
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
  const [tried, setTried] = useState(false);
  const leave = () => (location.href = location.pathname);
  if (tried && api.error) {
    return (
      <div className="play">
        <section className="card play-hero invited">
          <img className="play-hero-art" src={art('screens/host-left.webp')} alt="" />
          <div>
            <span className="eyebrow">Приглашение</span>
            <h1>Не получилось присоединиться</h1>
            <p className="muted">{api.error}</p>
            <div className="row wrap">
              <button className="primary big kap-button" onClick={() => { api.clearError(); leave(); }}>Создать новую игру</button>
            </div>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="play">
      <section className="card play-hero invited">
        <img className="play-hero-art" src={art('screens/waiting.webp')} alt="" />
        <div>
          <span className="eyebrow">Приглашение</span>
          <h1>Вас пригласили в игру</h1>
          <p className="muted">Вы играете как <strong>{name}</strong>. Профессию и мечту можно оставить случайными.</p>
          <Pickers professionId={professionId} dreamId={dreamId} onProfession={setProfessionId} onDream={setDreamId} />
          <div className="row wrap">
            <button className="primary big kap-button" onClick={() => { setTried(true); api.join(roomId, { professionId: professionId || undefined, dreamId: dreamId || undefined }); }}>
              Присоединиться
            </button>
            <button className="ghost" onClick={leave}>Не сейчас</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Pickers({ professionId, dreamId, onProfession, onDream }: {
  professionId: string; dreamId: string; onProfession: (id: string) => void; onDream: (id: string) => void;
}) {
  const random = !professionId && !dreamId;
  const summary = random ? 'Профессия и мечта: случайные'
    : `Профессия: ${professionId ? professionTitle(professionId) : 'случайная'} · мечта: ${dreamId ? content.dreams.find((d) => d.id === dreamId)?.title : 'случайная'}`;
  return (
    <details className="pickers">
      <summary>{summary}<span className="link">Изменить</span></summary>
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
