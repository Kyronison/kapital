import { defaultContent as content } from '@kapital/content';
import { useState } from 'react';
import type { TableApi } from '../net.js';

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
    <main className="home card">
      <h1>{roomId ? 'Вас пригласили за стол' : 'Новая партия'}</h1>
      <p className="muted">
        Получите профессию, вкладывайте свободные деньги в активы и выйдите из «Круга забот», когда пассивный
        доход покроет расходы. Побеждает тот, кто первым купит свою мечту или удвоит доход.
      </p>
      <label>
        Имя
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Как вас называть" />
      </label>
      <label>
        Профессия
        <select value={professionId} onChange={(e) => setProfessionId(e.target.value)}>
          <option value="">Случайная</option>
          {content.professions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}, зарплата {p.salary} К
            </option>
          ))}
        </select>
      </label>
      <label>
        Мечта
        <select value={dreamId} onChange={(e) => setDreamId(e.target.value)}>
          <option value="">Случайная</option>
          {content.dreams.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </label>
      <button className="primary" onClick={submit}>
        {roomId ? 'Сесть за стол' : 'Создать стол'}
      </button>
      {roomId && (
        <button className="link" onClick={() => (location.href = location.pathname)}>
          Создать свой стол вместо этого
        </button>
      )}
    </main>
  );
}
