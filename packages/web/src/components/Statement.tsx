import { content } from '../content.js';
import {
  baseExpenses, dreamPrice, gigIncome, loanPayment, passiveIncome, professionOf, type PlayerState,
} from '@kapital/engine';
import type { ReactNode } from 'react';
import { art, Icon } from '../art.js';
import { financeReport, type ReportSection } from '../finance-report.js';
import { dreamTitle, money, signed } from '../format.js';
import { showReportSection } from './FinanceReport.js';

export interface Flash {
  key: number;
  amount: number;
}

/** Наличные с всплывающей суммой последнего прихода или расхода. */
function Cash({ cash, flash }: { cash: number; flash: Flash | null }) {
  return (
    <div className="cash">
      <Icon name="ui-wallet" size={22} />
      <span className="big">{money(cash)}</span>
      {flash && (
        <span key={flash.key} className={flash.amount >= 0 ? 'money-pop' : 'coins-out'} aria-hidden="true">
          {signed(flash.amount)}
        </span>
      )}
    </div>
  );
}

const Row = ({ icon, label, children, tone }: { icon: string; label: ReactNode; children: ReactNode; tone?: string }) => (
  <>
    <dt><Icon name={icon} size={16} />{label}</dt>
    <dd className={tone}>{children}</dd>
  </>
);

/** Сводка финансов: доходы − расходы = поток; каждое слагаемое ведёт к своему разделу полного отчёта. */
export function Statement({ p, flash }: { p: PlayerState; flash: Flash | null }) {
  const prof = professionOf(content, p);
  const passive = passiveIncome(content, p);
  const expenses = baseExpenses(content, p) + loanPayment(content, p);

  if (p.circle === 'outer') {
    const goal = content.rules.outerGoalMultiplier * p.startOuterIncome;
    const price = dreamPrice(content, p);
    return (
      <section className="statement card outer">
        <header className="statement-head">
          <img className="dream-thumb" src={art(`dreams/${p.dreamId}.webp`)} alt="" />
          <div>
            <h2>Свободный путь</h2>
            <span className="muted">Мечта: {dreamTitle(p.dreamId)}</span>
          </div>
        </header>
        <Cash cash={p.cash} flash={flash} />
        <dl>
          <Row icon="ui-income" label="Доход за период">{money(p.outerIncome)}</Row>
          <Row icon="cell-dream" label="Цена мечты">{money(price)}</Row>
          <Row icon="ui-trophy" label="Или доход за период">{money(goal)}</Row>
        </dl>
        <Meter label={`Накоплено на мечту: ${Math.min(100, Math.floor((p.cash / price) * 100))}%`} value={p.cash} max={price} gold />
        <Meter label={`Доход: ${Math.min(100, Math.floor((p.outerIncome / goal) * 100))}% запасной цели`} value={p.outerIncome} max={goal} gold />
        {p.ventures.length > 0 && (
          <ul className="assets">
            {p.ventures.map((v) => (
              <li key={v.id}><Icon name="cell-venture" size={16} />{v.title} × {v.shares}<span>{signed(v.income)}</span></li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const r = financeReport(content, p);
  const flow = r.income.total - r.expenses.total;
  const cover = Math.min(100, Math.floor((passive / expenses) * 100));
  const scale = Math.max(r.income.total, r.expenses.total, 1);
  const incomeParts = r.income.groups.flatMap((g) => g.lines.filter((l) => !l.off && l.amount > 0).map((l) => ({ ...l, cls: g.title === 'Пассивный доход' ? 'seg-passive' : 'seg-active' })));
  const expenseParts = r.expenses.groups.flatMap((g) => g.lines.filter((l) => l.amount > 0));
  return (
    <section className="statement card">
      <header className="statement-head">
        <img className="portrait" src={art(`professions/${p.professionId}.webp`)} alt="" />
        <div>
          <h2>{prof.title}</h2>
          <span className="muted">Мечта: {dreamTitle(p.dreamId)}</span>
        </div>
      </header>
      <Cash cash={p.cash} flash={flash} />
      <div className="flow-sum" aria-label="Из чего складывается поток за период">
        <FlowTerm id="income" label="Доходы" amount={r.income.total} detail={
          `зарплата ${money(prof.salary)}${p.layoffPaydays > 0 ? ' (сейчас не приходит)' : ''} + пассивный ${money(passive)}${gigIncome(p) > 0 ? ` + подработки ${money(gigIncome(p))}` : ''}`
        }>
          <Bars parts={incomeParts} scale={scale} />
        </FlowTerm>
        <FlowTerm id="expenses" op="−" label="Расходы" amount={r.expenses.total} detail={
          `${r.expenses.groups.reduce((n, g) => n + g.lines.length, 0)} статей, крупнейшая: ${biggest(expenseParts)}`
        }>
          <Bars parts={expenseParts.map((l) => ({ ...l, cls: 'seg-expense' }))} scale={scale} />
        </FlowTerm>
        <div className="flow-result">
          <span><span className="op">=</span>Поток за период</span>
          <strong className={flow >= 0 ? 'good' : 'bad'}>{signed(flow)}</strong>
        </div>
      </div>
      <div className="balance-tiles">
        <button type="button" className="balance-tile" onClick={() => showReportSection('assets')}>
          <span className="muted"><Icon name="ui-wallet" size={14} />Активы</span>
          <b>{money(r.assets.total)}</b>
          <small className="muted">{count(r.assets)} · подробнее ›</small>
        </button>
        <button type="button" className="balance-tile" onClick={() => showReportSection('liabilities')}>
          <span className="muted"><Icon name="ui-bank" size={14} />Пассивы</span>
          <b>{money(r.liabilities.total)}</b>
          <small className="muted">кредит банка {money(p.bankLoan)} · ›</small>
        </button>
      </div>
      <Meter label={`Пассивный доход покрывает расходы на ${cover}%`} value={Math.min(passive, expenses)} max={expenses} />
      <p className="freedom-gap muted">
        {passive >= expenses
          ? 'Пассивный доход покрыл расходы: путь на «Свободный путь» открыт.'
          : <>До «Свободного пути» не хватает <b>{money(expenses - passive)}</b> пассивного дохода за период.</>}
      </p>
    </section>
  );
}

const biggest = (lines: { label: string; amount: number }[]) => {
  const top = [...lines].sort((a, b) => b.amount - a.amount)[0];
  return top ? `${top.label.toLowerCase()} ${money(top.amount)}` : 'нет';
};

const count = (s: ReportSection) => {
  const n = s.groups.reduce((sum, g) => sum + g.lines.length, 0);
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'статья' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'статьи' : 'статей'}`;
};

/** Слагаемое сводки: кнопка ведёт к своему разделу полного отчёта. */
function FlowTerm({ id, op, label, amount, detail, children }: {
  id: string; op?: string; label: string; amount: number; detail: string; children: ReactNode;
}) {
  return (
    <button type="button" className={`flow-term flow-${id}`} onClick={() => showReportSection(id)}>
      <span className="flow-line">
        <span className="flow-label">{op && <span className="op">{op}</span>}{label}</span>
        <b>{money(amount)}</b>
        <span className="flow-more" aria-hidden="true">›</span>
      </span>
      {children}
      <small className="muted">{detail}</small>
    </button>
  );
}

/** Полоса из отрезков-статей; доходы и расходы в одном масштабе, чтобы их было видно рядом. */
function Bars({ parts, scale }: { parts: { key: string; label: string; amount: number; cls: string }[]; scale: number }) {
  return (
    <span className="flow-bar" aria-hidden="true">
      {parts.map((x) => (
        <span key={x.key} className={x.cls} style={{ width: `${(x.amount / scale) * 100}%` }} title={`${x.label}: ${money(x.amount)}`} />
      ))}
    </span>
  );
}

function Meter({ label, value, max, gold }: { label: string; value: number; max: number; gold?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="meter-wrap">
      <span className="muted">{label}</span>
      <div className={`meter${gold ? ' gold' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
