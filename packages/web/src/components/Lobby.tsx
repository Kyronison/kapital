import { useState } from 'react';
import { art, Icon, playerColor } from '../art.js';
import { dreamTitle, professionTitle } from '../format.js';
import { Chat } from './Chat.js';
import type { TableApi, View } from '../net.js';
import { TURN_SECONDS_OPTIONS } from '@kapital/protocol';

const MAX_SEATS = 6;

const MODES = [
  { id: 'quick', icon: 'ui-clock', title: 'Быстрая партия', text: 'Стартовый бизнес и цели ближе. Около 20 ходов, на четверых примерно полчаса.' },
  { id: 'classic', icon: 'ui-trophy', title: 'Классика', text: 'С нуля, полный путь. Около 40 ходов, на четверых около часа.' },
] as const;

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
        <div className="row lobby-head">
          <h1>Стол ждёт игроков</h1>
          <button className="ghost" onClick={api.leave}><Icon name="ui-exit" size={18} />Выйти</button>
        </div>
        <p className="muted">Отправьте друзьям ссылку. За столом до 6 мест, пустые можно занять ботами, а можно сыграть и одному.</p>
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
        <fieldset className="modes" disabled={!isHost}>
          <legend>Режим</legend>
          {MODES.map((m) => (
            <label key={m.id} className={`choice mode${view.mode === m.id ? ' checked' : ''}`}>
              <input type="radio" name="mode" checked={view.mode === m.id} onChange={() => api.send('set_mode', m.id)} aria-label={m.title} />
              <Icon name={m.icon} size={24} />
              <strong>{m.title}</strong>
              <small>{m.text}</small>
            </label>
          ))}
        </fieldset>
        <fieldset className="modes timers" disabled={!isHost}>
          <legend>Время на ход</legend>
          {TURN_SECONDS_OPTIONS.map((s) => (
            <label key={s} className={`choice mode${view.turnSeconds === s ? ' checked' : ''}`}>
              <input type="radio" name="turn" checked={view.turnSeconds === s} onChange={() => api.send('set_turn_seconds', s)} aria-label={s ? `${s} секунд` : 'Без таймера'} />
              <strong>{s ? `${s} с` : 'Без таймера'}</strong>
              <small>{s === 0 ? 'Для игры с друзьями, которые не торопятся' : s === 30 ? 'Быстро: потом ход доиграет бот' : s === 60 ? 'Есть время прочитать карту' : 'Спокойно посчитать окупаемость'}</small>
            </label>
          ))}
        </fieldset>
        {view.seats.length < 2 && (
          <div className="waiting">
            <img src={art('screens/waiting.webp')} alt="" />
            <span className="muted">
              Можно начать одному: соревнуйтесь с рынком и лимитом ходов. Или позовите друзей и добавьте ботов.
            </span>
          </div>
        )}
        {isHost ? (
          <div className="row wrap">
            <button className="kap-button" onClick={() => api.send('add_bot')} disabled={view.seats.length >= MAX_SEATS}>
              <Icon name="ui-bot" />
              Добавить бота
            </button>
            <button className="primary kap-button" onClick={() => api.send('start')} disabled={view.seats.length < 1}>
              <Icon name="ui-dice" />
              {view.seats.length === 1 ? 'Играть одному' : 'Начать партию'}
            </button>
          </div>
        ) : (
          <p className="muted">Партию начнёт создатель стола.</p>
        )}
      </section>
      <Chat api={api} view={view} />
    </main>
  );
}
