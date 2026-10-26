import { defaultContent as content } from '@kapital/content';
import {
  availableLoan, baseExpenses, cashflow, dreamPrice, loanPayment, passiveIncome, professionOf, type PlayerState,
} from '@kapital/engine';
import { dreamTitle, money, signed } from '../format.js';

/** Финансовый отчёт игрока: главное число — поток за период. */
export function Statement({ p }: { p: PlayerState }) {
  const prof = professionOf(content, p);
  const passive = passiveIncome(p);
  const expenses = baseExpenses(content, p) + loanPayment(content, p);

  if (p.circle === 'outer') {
    const goal = content.rules.outerGoalMultiplier * p.startOuterIncome;
    return (
      <section className="statement card">
        <h2>Свободный путь</h2>
        <div className="big">{money(p.cash)}</div>
        <dl>
          <dt>Доход за период</dt><dd>{money(p.outerIncome)}</dd>
          <dt>Цель: удвоить доход</dt><dd>{money(goal)}</dd>
          <dt>Мечта: {dreamTitle(p.dreamId)}</dt><dd>{money(dreamPrice(content, p))}</dd>
        </dl>
        <progress max={goal} value={p.outerIncome} />
        {p.ventures.length > 0 && (
          <ul className="assets">
            {p.ventures.map((v) => (
              <li key={v.id}>{v.title} × {v.shares} <span>{signed(v.income)}</span></li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="statement card">
      <h2>{prof.title}</h2>
      <div className="big">{money(p.cash)}</div>
      <dl>
        <dt>Зарплата</dt><dd>{money(prof.salary)}{p.layoffPaydays > 0 ? ` (не придёт ещё ${p.layoffPaydays})` : ''}</dd>
        <dt>Пассивный доход</dt><dd>{money(passive)}</dd>
        <dt>Расходы</dt><dd>{money(expenses)}</dd>
        <dt>Поток за период</dt><dd className={cashflow(content, p) >= 0 ? 'good' : 'bad'}>{signed(cashflow(content, p))}</dd>
        <dt>Кредит банка</dt><dd>{money(p.bankLoan)} · ещё доступно {money(availableLoan(content, p))}</dd>
        <dt>Дети</dt><dd>{p.children}</dd>
      </dl>
      <label className="progress-label">
        Пассивный доход покрывает расходы на {Math.min(100, Math.round((passive / expenses) * 100))}%
        <progress max={expenses} value={Math.min(passive, expenses)} />
      </label>
      {(p.assets.length > 0 || p.stocks.length > 0) && (
        <ul className="assets">
          {p.assets.map((a) => (
            <li key={a.id}>{a.title} <span>{signed(a.flow)}</span></li>
          ))}
          {p.stocks.map((s) => (
            <li key={s.ticker}>Акции {s.ticker} × {s.shares} <span>по {Math.round(s.avgPrice)} К</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
