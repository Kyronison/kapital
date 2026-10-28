import type { PlayerState } from '@kapital/engine';
import { Icon } from '../art.js';
import { content } from '../content.js';
import { financeReport, type ReportSection } from '../finance-report.js';
import { money, signed } from '../format.js';

/** Прокрутить к разделу отчёта и коротко подсветить его: сюда ведут суммы из сводки. */
export function showReportSection(id: string) {
  const el = document.getElementById(`fin-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('fin-flash');
  void el.offsetWidth;
  el.classList.add('fin-flash');
}

function SectionCard({ s, sign }: { s: ReportSection; sign?: 1 | -1 }) {
  const fmt = (n: number) => (sign ? signed(sign * n) : money(n));
  return (
    <section id={`fin-${s.id}`} className={`fin-card card fin-${s.id}`} aria-labelledby={`fin-${s.id}-title`}>
      <header className="fin-card-head">
        <span className="fin-badge"><Icon name={s.icon} size={18} /></span>
        <div>
          <h3 id={`fin-${s.id}-title`}>{s.title}</h3>
          <p className="muted">{s.lead}</p>
        </div>
        <strong className="fin-total">{fmt(s.total)}</strong>
      </header>
      {s.groups.map((g) => (
        <div key={g.title} className="fin-group">
          <div className="fin-group-head">
            <span>{g.title}</span>
            {g.lines.length > 0 && <b>{fmt(g.total)}</b>}
          </div>
          {g.hint && <p className="fin-hint muted">{g.hint}</p>}
          {g.lines.length === 0 ? (
            <p className="fin-empty muted">{g.empty}</p>
          ) : (
            <ul>
              {g.lines.map((l) => {
                const share = s.total > 0 && !l.off ? Math.max(0, Math.min(100, (Math.abs(l.amount) / s.total) * 100)) : 0;
                return (
                  <li key={l.key} className={l.off ? 'off' : undefined}>
                    <Icon name={l.icon} size={16} />
                    <span className="fin-label">
                      {l.label}
                      {l.note && <small>{l.note}</small>}
                    </span>
                    <span className={`fin-amount${l.amount < 0 ? ' bad' : ''}`}>{fmt(l.amount)}</span>
                    <span className="fin-share" style={{ width: `${share}%` }} aria-hidden="true" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      <footer className="fin-foot">
        <span>Итого {s.title.toLowerCase()}</span>
        <b>{fmt(s.total)}</b>
      </footer>
    </section>
  );
}

/**
 * Полный финансовый отчёт: доходы и расходы за период, ниже активы и пассивы.
 * На компьютере стоит под полем, на телефоне — во вкладке «Финансы» под сводкой.
 */
export function FinanceReport({ p }: { p: PlayerState }) {
  const r = financeReport(content, p);
  const flow = r.income.total - r.expenses.total;
  return (
    <section className="fin-report" data-pane="money" aria-label="Финансовый отчёт">
      <h2 className="fin-step"><span>1</span>Что приходит и уходит каждый период</h2>
      <div className="fin-pair">
        <SectionCard s={r.income} sign={1} />
        <SectionCard s={r.expenses} sign={-1} />
      </div>
      <p className="fin-result">
        <span>Доходы {money(r.income.total)}</span>
        <span className="op">−</span>
        <span>Расходы {money(r.expenses.total)}</span>
        <span className="op">=</span>
        <strong className={flow >= 0 ? 'good' : 'bad'}>Поток {signed(flow)}</strong>
        <small className="muted">столько добавится к наличным в день зарплаты</small>
      </p>
      <h2 className="fin-step"><span>2</span>Что у вас есть и сколько вы должны</h2>
      <div className="fin-pair">
        <SectionCard s={r.assets} />
        <SectionCard s={r.liabilities} />
      </div>
    </section>
  );
}
