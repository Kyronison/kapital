import { useEffect, useRef, useState } from 'react';
import { art, Icon, playerColor } from '../art.js';
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

/** Стикер уходит в чат обычным сообщением вида `:clap:`, клиент рисует его картинкой. */
const STICKERS: Record<string, string> = {
  'thumbs-up': 'Класс', clap: 'Браво', deal: 'Сделка', coin: 'Деньги', rocket: 'Взлёт', fire: 'Огонь',
  wow: 'Ого', laugh: 'Смешно', think: 'Хм', sad: 'Грустно', heart: 'Сердце', gg: 'Хорошая игра',
};
const stickerOf = (text: string) => {
  const m = /^:([a-z-]+):$/.exec(text);
  return m && m[1]! in STICKERS ? m[1]! : null;
};

export function Chat({ api, view }: { api: TableApi; view: View }) {
  const [text, setText] = useState('');
  const [stickers, setStickers] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const listRef = useRef<HTMLOListElement>(null);
  const last = api.chat.at(-1);
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
    setStickers(false);
  };

  const color = (seatId: string) => playerColor(Math.max(0, view.seats.findIndex((s) => s.id === seatId)));

  return (
    <section className="chat card">
      <h2>
        <Icon name="ui-chat" size={16} />Чат стола
        <button className="icon-button" onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'} title={muted ? 'Включить звук' : 'Выключить звук'}>
          <Icon name={muted ? 'ui-mute' : 'ui-sound-on'} size={16} />
        </button>
      </h2>
      {api.chat.length === 0 ? (
        <div className="chat-empty">
          <img src={art('screens/chat-empty.webp')} alt="" />
          <p className="muted">Пока тихо. Поздоровайтесь со столом.</p>
        </div>
      ) : (
        <ol ref={listRef}>
          {api.chat.map((m) => {
            const sticker = stickerOf(m.text);
            return (
              <li key={m.n} className="chat-in">
                <strong style={{ color: color(m.seatId) }}>{m.name}</strong>{' '}
                {sticker ? <img className="sticker sticker-pop" src={art(`stickers/${sticker}.webp`)} alt={STICKERS[sticker]} title={STICKERS[sticker]} /> : m.text}
              </li>
            );
          })}
        </ol>
      )}
      <div className="quick">
        {QUICK.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
      </div>
      {stickers && (
        <div className="sticker-picker">
          {Object.entries(STICKERS).map(([id, label]) => (
            <button key={id} type="button" onClick={() => send(`:${id}:`)} aria-label={label} title={label}>
              <img src={art(`stickers/${id}.webp`)} alt="" />
            </button>
          ))}
        </div>
      )}
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <button type="button" className="icon-button" onClick={() => setStickers(!stickers)} aria-pressed={stickers} aria-label="Стикеры" title="Стикеры">
          <Icon name="ui-emoji" size={20} />
        </button>
        <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" aria-label="Сообщение в чат" />
        <button className="primary" type="submit" disabled={!text.trim()} aria-label="Отправить" title="Отправить">
          <Icon name="ui-send" size={18} />
        </button>
      </form>
    </section>
  );
}
