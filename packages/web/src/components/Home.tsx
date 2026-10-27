import { levels } from '@kapital/content';
import { content } from '../content.js';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { art, Icon } from '../art.js';
import { hideSave, listSaves, type AccountApi } from '../auth.js';
import type { SaveSummary, TableApi } from '../net.js';
import { updateSettings, useSettings } from '../settings.js';

const nf = new Intl.NumberFormat('ru-RU');

export function Home({ api, auth, onTraining }: { api: TableApi; auth: AccountApi; onTraining: () => void }) {
  const roomId = new URLSearchParams(location.search).get('room');
  const [professionId, setProfessionId] = useState('');
  const [dreamId, setDreamId] = useState('');
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const settings = useSettings();
  const account = auth.state.status === 'in' ? auth.state.account : null;

  // незаконченные партии лежат в аккаунте: список один на все устройства
  useEffect(() => {
    listSaves().then(setSaves).catch(() => setSaves([]));
  }, []);

  const submit = () => {
    const opts = { professionId: professionId || undefined, dreamId: dreamId || undefined };
    if (roomId) api.join(roomId, opts);
    else api.create(opts);
  };

  return (
    <main className="home">
      <section className="hero">
        <h1>{roomId ? 'Вас пригласили за стол' : 'Постройте свой капитал'}</h1>
        <p>
          Получите профессию, вкладывайте свободные деньги в активы и выйдите из «Круга забот», когда пассивный
          доход покроет расходы. Побеждает тот, кто первым купит свою мечту.
        </p>
        {!roomId && (
          <button className="kap-button training-entry" onClick={onTraining}>
            <Icon name="ui-level" />
            Тренировка: {levels.length} уровней с целью и сроком
          </button>
        )}
        {!roomId && saves.length > 0 && (
          <section className="saves card">
            <h2><Icon name="ui-archive" size={18} />Незаконченные партии</h2>
            <ul>
              {saves.map((x) => (
                <li key={x.saveId}>
                  <span>
                    <strong>{x.players.join(', ')}</strong>
                    <small className="muted">
                      {x.mode === 'quick' ? 'Быстрая' : 'Классика'} · ход {x.turn} · {new Date(x.savedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </span>
                  <button className="primary" onClick={() => api.resume(x.saveId)}><Icon name="ui-continue" size={16} />Продолжить</button>
                  <button className="ghost" aria-label="Убрать из списка" title="Убрать из списка" onClick={() => { void hideSave(x.saveId).catch(() => undefined); setSaves(saves.filter((s) => s.saveId !== x.saveId)); }}>×</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {account && !roomId && <Profile auth={auth} />}
      </section>
      <form className="join card" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {account && <p className="muted">За стол садится <strong>{account.user.name}</strong>. Имя меняется в профиле.</p>}

        <fieldset>
          <legend>Профессия</legend>
          <div className="picker professions">
            <Choice checked={professionId === ''} onPick={() => setProfessionId('')} group="profession" label="Случайная">
              <span className="random"><Icon name="ui-dice" size={32} /></span>
              <strong>Случайная</strong>
            </Choice>
            {content.professions.map((p) => (
              <Choice key={p.id} checked={professionId === p.id} onPick={() => setProfessionId(p.id)} group="profession" label={p.title}>
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
            <Choice checked={dreamId === ''} onPick={() => setDreamId('')} group="dream" label="Случайная">
              <span className="random"><Icon name="cell-dream" size={32} /></span>
              <strong>Случайная</strong>
            </Choice>
            {content.dreams.map((d) => (
              <Choice key={d.id} checked={dreamId === d.id} onPick={() => setDreamId(d.id)} group="dream" label={d.title}>
                <img src={art(`dreams/${d.id}.webp`)} alt="" loading="lazy" />
                <strong>{d.title}</strong>
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="learning">
          <legend>Обучение</legend>
          <label className="toggle">
            <input type="checkbox" checked={settings.hints} onChange={(e) => updateSettings({ hints: e.target.checked, seenHints: e.target.checked ? [] : settings.seenHints })} />
            <span><strong>Подсказки наставника</strong><small className="muted">Короткие объяснения в первый раз, когда что-то происходит.</small></span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.fillReport} onChange={(e) => updateSettings({ fillReport: e.target.checked })} />
            <span><strong>Заполнять отчёт самому</strong><small className="muted">После сделок раскладывайте строки по доходам, расходам, активам и пассивам.</small></span>
          </label>
        </fieldset>

        <button className="primary big kap-button" type="submit">
          {roomId ? 'Сесть за стол' : 'Создать стол'}
        </button>
        {roomId && (
          <button type="button" className="link" onClick={() => (location.href = location.pathname)}>
            Создать свой стол вместо этого
          </button>
        )}
      </form>
    </main>
  );
}

const PROVIDER_TITLES = { email: 'Почта', google: 'Google', yandex: 'Яндекс', telegram: 'Telegram' } as const;

/** Профиль: имя за столом, пароль и способы входа. Новые способы привязываются к этому же аккаунту. */
function Profile({ auth }: { auth: AccountApi }) {
  const account = auth.state.status === 'in' ? auth.state.account : null;
  const providers = auth.state.status === 'in' ? auth.state.providers : null;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account?.user.name ?? '');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<string | null>(null);
  if (!account || !providers) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const patch: { name?: string; password?: string } = {};
    if (name.trim() && name.trim() !== account.user.name) patch.name = name;
    if (password) patch.password = password;
    auth.update(patch).then(() => { setNote('Сохранено'); setPassword(''); }).catch((err: Error) => setNote(err.message));
  };
  const linked = (p: keyof typeof PROVIDER_TITLES) => account.logins.find((l) => l.provider === p);

  return (
    <section className="saves card profile">
      <h2>
        <Icon name="ui-user" size={18} />
        {account.user.name}
        <button type="button" className="link" onClick={() => setOpen(!open)}>{open ? 'Свернуть' : 'Профиль'}</button>
        <button type="button" className="link" onClick={() => void auth.logout()}>Выйти</button>
      </h2>
      {open && (
        <form className="join" onSubmit={save}>
          <label className="field">
            <span>Имя за столом</span>
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{account.hasPassword ? 'Новый пароль' : 'Пароль для входа без письма'}</span>
            <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="не короче 8 символов" />
          </label>
          <div className="row wrap">
            <button className="primary" type="submit">Сохранить</button>
            {note && <span className="muted">{note}</span>}
          </div>
          <div className="logins">
            <span className="muted">Способы входа</span>
            <ul>
              {(Object.keys(PROVIDER_TITLES) as (keyof typeof PROVIDER_TITLES)[]).map((p) => {
                const l = linked(p);
                const available = p === 'email' ? providers.email : p === 'telegram' ? !!providers.telegram : providers[p];
                if (!l && !available) return null;
                return (
                  <li key={p}>
                    <strong>{PROVIDER_TITLES[p]}</strong>
                    {l ? <span className="muted">{l.label ?? 'привязан'}</span>
                      : p === 'google' || p === 'yandex' ? <a className="link" href={`/api/auth/oauth/${p}/start`}>Привязать</a>
                      : <span className="muted">{p === 'email' ? 'введите код из письма на экране входа' : 'войдите через виджет на экране входа'}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </form>
      )}
    </section>
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
