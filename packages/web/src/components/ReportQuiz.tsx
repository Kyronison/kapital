import { content } from '../content.js';
import type { GameEvent } from '@kapital/engine';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { art, Icon } from '../art.js';
import { money, signed } from '../format.js';
import { updateSettings, useSettings } from '../settings.js';

type Section = 'income' | 'expenses' | 'assets' | 'liabilities';

const SECTIONS: { id: Section; title: string; icon: string }[] = [
  { id: 'income', title: 'Доходы', icon: 'ui-income' },
  { id: 'expenses', title: 'Расходы', icon: 'ui-expense' },
  { id: 'assets', title: 'Активы', icon: 'ui-wallet' },
  { id: 'liabilities', title: 'Пассивы', icon: 'ui-bank' },
];

interface Line {
  key: string;
  label: string;
  answer: Section;
  why: string;
}

const deals = () => [...content.smallDeals, ...content.bigDeals];

/** Какие строки отчёта меняет событие игрока. */
function linesOf(e: GameEvent, n: number): Line[] {
  const k = (i: number) => `${n}-${i}`;
  switch (e.type) {
    case 'bought': {
      const card = deals().find((c) => c.id === e.cardId);
      const venture = content.ventures.find((c) => c.id === e.cardId);
      if (venture) return [{ key: k(0), label: `Доли «${venture.title}»`, answer: 'assets', why: 'Доли приносят доход — это актив.' }];
      if (!card) return [];
      if (card.kind === 'asset') {
        const lines: Line[] = [
          { key: k(0), label: card.title, answer: card.flow >= 0 ? 'assets' : 'liabilities', why: card.flow >= 0 ? 'Приносит деньги каждый период — актив.' : 'Забирает деньги каждый период — по сути пассив.' },
        ];
        if (card.cost > card.down) lines.push({ key: k(1), label: `Ипотека ${money(card.cost - card.down)}`, answer: 'liabilities', why: 'Долг банку — пассив.' });
        if (card.flow > 0) lines.push({ key: k(2), label: `Поток ${signed(card.flow)}`, answer: 'income', why: 'Регулярный приход от актива — пассивный доход.' });
        return lines;
      }
      if (card.kind === 'bond') {
        return [
          { key: k(0), label: card.title, answer: 'assets', why: 'Облигации приносят купон — актив.' },
          { key: k(1), label: `Купон ${signed(card.coupon)} за штуку`, answer: 'income', why: 'Купон — пассивный доход.' },
        ];
      }
      return [{ key: k(0), label: `Акции ${card.ticker}`, answer: 'assets', why: 'Бумаги, которые можно продать дороже, — актив.' }];
    }
    case 'loan_taken':
      return [
        { key: k(0), label: `Кредит банка ${money(e.amount)}`, answer: 'liabilities', why: 'Долг — пассив.' },
        { key: k(1), label: 'Платёж по кредиту', answer: 'expenses', why: 'Каждый период за кредит платится процент — это расход.' },
      ];
    case 'child_born':
      return [{ key: k(0), label: 'Расходы на ребёнка', answer: 'expenses', why: 'Ребёнок увеличивает расходы за период.' }];
    case 'subscribed':
      return [{ key: k(0), label: e.title, answer: 'expenses', why: 'Ежемесячная трата — расход.' }];
    case 'insured':
      return [{ key: k(0), label: 'Взнос по полису', answer: 'expenses', why: 'Взнос платится каждый период — расход.' }];
    case 'deposited':
      return [{ key: k(0), label: `Вклад ${money(e.amount)}`, answer: 'assets', why: 'Вклад приносит процент — актив.' }];
    default:
      return [];
  }
}

/**
 * Режим «Заполни отчёт»: после своих сделок игрок сам раскладывает строки по разделам.
 * Строку можно перетащить или выбрать нажатием, а потом нажать на раздел.
 */
export function ReportQuiz({ log, logStart, me }: { log: GameEvent[]; logStart: number; me: string | null }) {
  const settings = useSettings();
  const [lines, setLines] = useState<Line[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; ok: boolean; why: string } | null>(null);
  const seen = useRef(logStart + log.length);

  useEffect(() => {
    const fresh: Line[] = [];
    for (let n = Math.max(seen.current, logStart); n < logStart + log.length; n++) {
      const e = log[n - logStart]!;
      if ('playerId' in e && e.playerId === me) fresh.push(...linesOf(e, n));
    }
    seen.current = logStart + log.length;
    if (fresh.length && settings.fillReport) setLines((prev) => [...prev, ...fresh].slice(-6));
  }, [log, logStart, me, settings.fillReport]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  if (!settings.fillReport || (lines.length === 0 && !feedback)) return null;

  const place = (key: string, section: Section) => {
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    const ok = line.answer === section;
    setFeedback({ key, ok, why: line.why });
    updateSettings((s) => ({ reportRight: s.reportRight + (ok ? 1 : 0), reportTotal: s.reportTotal + 1 }));
    setPicked(null);
    if (ok) setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const drop = (section: Section) => (e: DragEvent) => {
    e.preventDefault();
    place(e.dataTransfer.getData('text/plain'), section);
  };

  return (
    <section className="report-quiz card">
      <h2>
        <Icon name="ui-chart" size={16} />Заполните отчёт
        <small className="muted">верно {settings.reportRight} из {settings.reportTotal}</small>
      </h2>
      <ul className="quiz-lines">
        {lines.map((l) => (
          <li key={l.key}>
            <button
              className={`chip drag-line${picked === l.key ? ' picked' : ''}${feedback?.key === l.key && !feedback.ok ? ' drop-wrong' : ''}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', l.key)}
              onClick={() => setPicked(picked === l.key ? null : l.key)}
              aria-pressed={picked === l.key}
            >
              <Icon name="ui-drag" size={14} />{l.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="quiz-zones">
        {SECTIONS.map((z) => (
          <button
            key={z.id}
            className={`quiz-zone${picked ? ' drag-hint' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={drop(z.id)}
            onClick={() => picked && place(picked, z.id)}
          >
            <Icon name={z.icon} size={18} />{z.title}
          </button>
        ))}
      </div>
      {feedback && (
        <p key={`${feedback.key}-${feedback.ok}`} className={feedback.ok ? 'quiz-ok' : 'quiz-wrong'}>
          <img className={feedback.ok ? 'drop-ok-mark' : 'drop-wrong'} src={art(feedback.ok ? 'report/drop-ok.webp' : 'report/drop-wrong.webp')} alt="" />
          {feedback.ok ? 'Верно. ' : 'Не туда. '}{feedback.ok ? feedback.why : 'Попробуйте другой раздел.'}
        </p>
      )}
      {!picked && lines.length > 0 && <p className="muted">Перетащите строку в раздел или нажмите на строку, а потом на раздел.</p>}
    </section>
  );
}
