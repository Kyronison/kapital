import { content } from '../content.js';
import { useState, type ReactNode } from 'react';
import { art, Icon } from '../art.js';
import type { TableApi } from '../net.js';

const nf = new Intl.NumberFormat('ru-RU');

export function Home({ api }: { api: TableApi }) {
  const roomId = new URLSearchParams(location.search).get('room');
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('kapital:name') ?? '';
    } catch {
      return '';
    }
  });
  const [professionId, setProfessionId] = useState('');
  const [dreamId, setDreamId] = useState('');

  const submit = () => {
    try {
      localStorage.setItem('kapital:name', name);
    } catch {
      // имя просто не запомнится
    }
    const opts = { name, professionId: professionId || undefined, dreamId: dreamId || undefined };
    if (roomId) api.join(roomId, opts);
    else api.create(opts);
  };

  return (
    <main className="home">
      <section className="hero">
        <h1>{roomId ? 'Вас пригласили за стол' : 'Постройте свой капитал'}</h1>
        <p>
          Получите профессию, вкладывайте свободные деньги в активы и выйдите из «Круга забот», когда пассивный
          доход покроет расходы. Побеждает тот, кто первым купит свою мечту или удвоит доход.
        </p>
      </section>
      <form className="join card" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field">
          <span>Имя</span>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Как вас называть" />
        </label>

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
