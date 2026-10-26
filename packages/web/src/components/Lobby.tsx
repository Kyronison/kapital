import { useState } from 'react';
import { dreamTitle, professionTitle } from '../format.js';
import type { TableApi, View } from '../net.js';

export function Lobby({ api, view }: { api: TableApi; view: View }) {
  const isHost = view.hostId === api.me;
  const link = `${location.origin}${location.pathname}?room=${api.room?.roomId ?? ''}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="lobby card">
      <h1>Стол ждёт игроков</h1>
      <p className="muted">Отправьте друзьям ссылку. За столом от 2 до 6 мест, пустые можно занять ботами.</p>
      <div className="invite">
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Ссылка-приглашение" />
        <button onClick={copy}>{copied ? 'Скопировано' : 'Копировать'}</button>
      </div>
      <ul className="seats">
        {view.seats.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong>
            {s.id === view.hostId && <span className="badge">создатель</span>}
            {s.id === api.me && <span className="badge">вы</span>}
            {s.bot && <span className="badge">бот</span>}
            <span className="muted">
              {professionTitle(s.professionId)} · мечта: {dreamTitle(s.dreamId)}
            </span>
          </li>
        ))}
      </ul>
      {isHost ? (
        <div className="row">
          <button onClick={() => api.send('add_bot')} disabled={view.seats.length >= 6}>
            Добавить бота
          </button>
          <button className="primary" onClick={() => api.send('start')} disabled={view.seats.length < 2}>
            Начать партию
          </button>
        </div>
      ) : (
        <p className="muted">Партию начнёт создатель стола.</p>
      )}
    </main>
  );
}
