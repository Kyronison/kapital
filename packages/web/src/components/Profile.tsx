import { levels } from '@kapital/content';
import { AVATARS } from '@kapital/protocol';
import { useState, type FormEvent } from 'react';
import { art, Icon } from '../art.js';
import type { AccountApi } from '../auth.js';
import { useProgress } from '../campaign-progress.js';
import { useRating } from '../rating.js';
import { Avatar } from './Shell.js';

const PROVIDER_TITLES = { email: 'Почта', google: 'Google', yandex: 'Яндекс ID', telegram: 'Telegram' } as const;

/** Профиль: итоги, имя за столом, пароль и способы входа. Новые способы привязываются к этому же аккаунту. */
export function Profile({ auth }: { auth: AccountApi }) {
  const account = auth.state.status === 'in' ? auth.state.account : null;
  const providers = auth.state.status === 'in' ? auth.state.providers : null;
  const progress = useProgress();
  const rating = useRating();
  const [name, setName] = useState(account?.user.name ?? '');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  if (!account || !providers) return null;

  const stars = Object.values(progress).reduce((a, b) => a + b, 0);
  const passed = Object.keys(progress).length;
  const stats = rating?.stats;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const patch: { name?: string; password?: string } = {};
    if (name.trim() && name.trim() !== account.user.name) patch.name = name;
    if (password) patch.password = password;
    if (!patch.name && !patch.password) return setNote('Нечего сохранять');
    auth.update(patch).then(() => { setNote('Сохранено'); setPassword(''); }).catch((err: Error) => setNote(err.message));
  };
  const linked = (p: keyof typeof PROVIDER_TITLES) => account.logins.find((l) => l.provider === p);

  return (
    <div className="profile-page">
      <section className="card profile-head">
        <button className="avatar-edit" onClick={() => setPicking(!picking)} aria-expanded={picking} aria-label="Сменить аватар" title="Сменить аватар">
          <Avatar name={account.user.name} avatar={account.user.avatar} size={88} />
          <span className="avatar-edit-badge"><Icon name="ui-camera" size={16} /></span>
        </button>
        <div>
          <h1>{account.user.name}</h1>
          <p className="muted">{account.user.email ?? account.logins.map((l) => PROVIDER_TITLES[l.provider]).join(', ')}</p>
        </div>
        <button className="ghost logout" onClick={() => void auth.logout()}><Icon name="ui-logout" size={18} />Выйти</button>
      </section>
      {picking && (
        <section className="card avatar-picker" aria-label="Выбор аватара">
          <h2><Icon name="ui-user-circle" size={18} />Выберите аватар</h2>
          <div className="avatar-grid" role="radiogroup">
            {AVATARS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={account.user.avatar === id}
                aria-label={`Аватар ${id}`}
                className={account.user.avatar === id ? 'checked' : undefined}
                onClick={() => auth.update({ avatar: id }).then(() => setPicking(false)).catch((err: Error) => setNote(err.message))}
              >
                <img src={art(`avatars/${id}.webp`)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      <h2 className="section-title">Игра</h2>
      <ul className="stat-tiles">
        <li><Icon name="ui-star-filled" /><strong>{stars}<small>/{levels.length * 3}</small></strong><span>звёзд тренировки</span></li>
        <li><Icon name="ui-level" /><strong>{passed}<small>/{levels.length}</small></strong><span>уровней пройдено</span></li>
        <li><Icon name="ui-dice" /><strong>{stats?.games ?? 0}</strong><span>партий доиграно</span></li>
        <li><Icon name="ui-crown" /><strong>{stats?.wins ?? 0}</strong><span>побед</span></li>
        <li><Icon name="ui-trophy" /><strong>{rating?.games.me.place ?? rating?.training.me.place ?? '—'}</strong><span>{rating?.games.me.place ? 'место в партиях месяца' : 'место в тренировке'}</span></li>
      </ul>

      <div className="profile-grid">
        <form className="card join" onSubmit={save}>
          <img className="card-corner-art" src={art('account/password.webp')} alt="" />
          <h2><Icon name="ui-pencil" size={18} />Аккаунт</h2>
          <label className="field">
            <span>Имя за столом и в рейтинге</span>
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          {/* пароль нужен только тем, кто входит по почте: с Яндексом или Telegram он ни к чему */}
          {(account.hasPassword || linked('email')) && (
            <label className="field">
              <span>{account.hasPassword ? 'Новый пароль' : 'Пароль, чтобы входить по почте без письма'}</span>
              <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="не короче 8 символов" />
            </label>
          )}
          <div className="row wrap">
            <button className="primary" type="submit">Сохранить</button>
            {note && <span className="muted">{note}</span>}
          </div>
        </form>

        <section className="card logins">
          <img className="card-corner-art" src={art('account/linked.webp')} alt="" />
          <h2><Icon name="ui-link" size={18} />Способы входа</h2>
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
        </section>
      </div>
    </div>
  );
}
