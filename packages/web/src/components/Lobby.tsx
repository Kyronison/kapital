import { useState } from 'react';
import { art, Icon, playerColor } from '../art.js';
import { dreamTitle, professionTitle } from '../format.js';
import type { TableApi, View } from '../net.js';

const MAX_SEATS = 6;

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
    <main className="lobby">
      <section className="card lobby-card">
        <h1>Стол ждёт игроков</h1>
        <p className="muted">Отправьте друзьям ссылку. За столом от 2 до 6 мест, пустые можно занять ботами.</p>
        <div className="invite">
          <Icon name="ui-link" />
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Ссылка-приглашение" />
          <button onClick={copy} className="kap-button">
            <Icon name="ui-copy" />
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
        <ul className="seats">
          {view.seats.map((s, i) => (
            <li key={s.id} className="toast-in" style={{ borderColor: playerColor(i) }}>
              {s.professionId ? (
                <img src={art(`professions/${s.professionId}.webp`)} alt="" />
              ) : (
                <span className="random"><Icon name="ui-dice" size={28} /></span>
              )}
              <span className="who">
                <strong>
                  {s.name}
                  {s.id === view.hostId && <span className="badge"><Icon name="ui-crown" size={12} />создатель</span>}
                  {s.id === api.me && <span className="badge">вы</span>}
                  {s.bot && <span className="badge"><Icon name="ui-bot" size={12} />бот</span>}
                </strong>
                <span className="muted">{professionTitle(s.professionId)} · мечта: {dreamTitle(s.dreamId)}</span>
              </span>
            </li>
          ))}
          {Array.from({ length: MAX_SEATS - view.seats.length }, (_, i) => (
            <li key={`empty-${i}`} className="empty-seat">
              <span className="random"><Icon name="ui-user" size={28} /></span>
              <span className="muted">Свободное место</span>
            </li>
          ))}
        </ul>
        {view.seats.length < 2 && (
          <div className="waiting">
            <img src={art('screens/waiting.webp')} alt="" />
            <span className="muted">Нужен хотя бы ещё один игрок или бот.</span>
          </div>
        )}
        {isHost ? (
          <div className="row wrap">
            <button className="kap-button" onClick={() => api.send('add_bot')} disabled={view.seats.length >= MAX_SEATS}>
              <Icon name="ui-bot" />
              Добавить бота
            </button>
            <button className="primary kap-button" onClick={() => api.send('start')} disabled={view.seats.length < 2}>
              <Icon name="ui-dice" />
              Начать партию
            </button>
          </div>
        ) : (
          <p className="muted">Партию начнёт создатель стола.</p>
        )}
      </section>
    </main>
  );
}
