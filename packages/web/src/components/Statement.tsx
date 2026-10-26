import { content } from '../content.js';
import {
  availableLoan, baseExpenses, depositIncome, cashflow, dreamPrice, loanPayment, passiveIncome, professionOf, type PlayerState,
} from '@kapital/engine';
import type { ReactNode } from 'react';
import { art, Icon } from '../art.js';
import { dreamTitle, money, RISK_TITLES, signed } from '../format.js';

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

/** Финансовый отчёт игрока: главное число — поток за период. */
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
          <Row icon="ui-trophy" label="Цель: удвоить доход">{money(goal)}</Row>
          <Row icon="cell-dream" label="Цена мечты">{money(price)}</Row>
        </dl>
        <Meter label={`Доход: ${Math.min(100, Math.floor((p.outerIncome / goal) * 100))}% цели`} value={p.outerIncome} max={goal} gold />
        <Meter label={`Накоплено на мечту: ${Math.min(100, Math.floor((p.cash / price) * 100))}%`} value={p.cash} max={price} gold />
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

  const flow = cashflow(content, p);
  const cover = Math.min(100, Math.floor((passive / expenses) * 100));
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
      <dl>
        <Row icon="cell-payday" label="Зарплата">
          {money(prof.salary)}{p.layoffPaydays > 0 ? ` (не придёт ещё ${p.layoffPaydays})` : ''}
        </Row>
        <Row icon="ui-income" label="Пассивный доход">{money(passive)}</Row>
        <Row icon="ui-expense" label="Расходы">{money(expenses)}</Row>
        <Row icon="ui-cashflow" label="Поток за период" tone={flow >= 0 ? 'good' : 'bad'}>{signed(flow)}</Row>
        <Row icon="ui-bank" label="Кредит банка">
          {money(p.bankLoan)}<small> · ещё {money(availableLoan(content, p))}</small>
        </Row>
        <Row icon="ui-family" label="Дети">{p.children}</Row>
        {p.deposit > 0 && (
          <Row icon="ui-bank" label="Вклад">
            {money(p.deposit)}<small> · {signed(depositIncome(content, p))} за период</small>
          </Row>
        )}
        {p.savings > 0 && <Row icon="ui-training" label="Тренинги снизили расходы" tone="good">{signed(-p.savings)}</Row>}
      </dl>
      {(p.policies.length > 0 || p.subscriptions.length > 0) && (
        <ul className="assets everyday">
          {p.policies.map((x) => (
            <li key={x.risk}>
              <Icon name={`ui-insurance-${x.risk === 'health' ? 'life' : 'property'}`} size={16} />
              {RISK_TITLES[x.risk]}<span>{signed(-x.premium)}</span>
            </li>
          ))}
          {p.subscriptions.map((x, i) => (
            <li key={`${x.cardId}-${i}`}>
              <Icon name="ui-subscription" size={16} />
              {x.title} <small className="muted">ещё {x.paydaysLeft}</small><span>{signed(-x.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <Meter label={`Пассивный доход покрывает расходы на ${cover}%`} value={Math.min(passive, expenses)} max={expenses} />
      {p.assets.length > 0 || p.stocks.length > 0 || p.bonds.length > 0 ? (
        <ul className="assets">
          {p.assets.map((a) => (
            <li key={a.id}><Icon name={`asset-${a.assetType}`} size={16} />{a.title}<span>{signed(a.flow)}</span></li>
          ))}
          {p.bonds.map((b) => (
            <li key={b.id}><Icon name="ui-income" size={16} />{b.title} × {b.count}<span>{signed(b.count * b.coupon)}</span></li>
          ))}
          {p.stocks.map((s) => (
            <li key={s.ticker}><Icon name={`stock-${s.ticker.toLowerCase()}`} size={16} />Акции {s.ticker} × {s.shares}<span>по {Math.round(s.avgPrice)} К</span></li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <img src={art('screens/empty-assets.webp')} alt="" />
          <span className="muted">Активов пока нет. Ищите сделки на клетках «Возможность».</span>
        </div>
      )}
    </section>
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
