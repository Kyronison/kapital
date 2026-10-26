import { useEffect, useRef, useState } from 'react';
import { Icon, playerColor } from '../art.js';
import type { TableApi, View } from '../net.js';

const MUTE_KEY = 'kapital:mute';

/** Короткий сигнал о новом сообщении: звук синтезируется, файлов не нужно. */
function blip() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => void ctx.close();
  } catch {
    // без звука
  }
}

const QUICK = ['Привет!', 'Удачи!', 'Хорошая сделка', 'Ого!', 'Спасибо за игру'];

export function Chat({ api, view }: { api: TableApi; view: View }) {
  const [text, setText] = useState('');
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const listRef = useRef<HTMLOListElement>(null);
  const last = view.chat.at(-1);
  const seen = useRef(last?.n ?? 0);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    if (!last || last.n <= seen.current) return;
    seen.current = last.n;
    if (!muted && last.seatId !== api.me) blip();
  }, [last, muted, api.me]);

  const toggleMute = () => {
    setMuted(!muted);
    try {
      localStorage.setItem(MUTE_KEY, muted ? '0' : '1');
    } catch {
      // настройка не запомнится
    }
  };

  const send = (t: string) => {
    if (!t.trim()) return;
    api.say(t);
    setText('');
  };

  const color = (seatId: string) => playerColor(Math.max(0, view.seats.findIndex((s) => s.id === seatId)));

  return (
    <section className="chat card">
      <h2>
        <Icon name="ui-chat" size={16} />Чат стола
        <button className="icon-button" onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'} title={muted ? 'Включить звук' : 'Выключить звук'}>
          <Icon name={muted ? 'ui-sound-off' : 'ui-sound-on'} size={16} />
        </button>
      </h2>
      {view.chat.length === 0 ? (
        <p className="muted">Пока тихо. Поздоровайтесь со столом.</p>
      ) : (
        <ol ref={listRef}>
          {view.chat.map((m) => (
            <li key={m.n} className="chat-in">
              <strong style={{ color: color(m.seatId) }}>{m.name}</strong> {m.text}
            </li>
          ))}
        </ol>
      )}
      <div className="quick">
        {QUICK.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" aria-label="Сообщение в чат" />
        <button className="primary" type="submit" disabled={!text.trim()}>Отправить</button>
      </form>
    </section>
  );
}
