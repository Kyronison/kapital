import { content } from '../content.js';
import {
  availableLoan, cashflow, everydayAmount, passiveIncome, roundUpToStep, totalExpenses, trainingSaving, type PlayerState,
} from '@kapital/engine';
import { money, signed } from '../format.js';
import type { PublicGame } from '../net.js';

/** Что изменится у игрока после решения: считаем на копии игрока теми же формулами, что движок. */
interface Preview {
  pay: number;
  loan: number;
  cashAfter: number;
  flow: [number, number];
  passive: [number, number];
  expenses: [number, number];
  /** Доход «Свободного пути» до и после, для проектов второго круга. */
  outer?: [number, number];
  risky?: boolean;
}

function preview(me: PlayerState, pay: number, apply: (p: PlayerState) => void, withLoan: boolean): Preview | null {
  const short = pay - me.cash;
  const loan = short > 0 && withLoan ? roundUpToStep(short, content.rules.loanStep) : 0;
  if (short > 0 && (!withLoan || loan > availableLoan(content, me))) return null;
  const after = structuredClone(me);
  after.bankLoan += loan;
  after.cash += loan - pay;
  apply(after);
  return {
    pay, loan, cashAfter: after.cash,
    flow: [cashflow(content, me), cashflow(content, after)],
    passive: [passiveIncome(content, me), passiveIncome(content, after)],
    expenses: [totalExpenses(content, me), totalExpenses(content, after)],
  };
}

/**
 * Последствия текущей сделки для того, кто ходит: сколько отдать сейчас, сколько останется,
 * как изменятся поток, пассивный доход и расходы. `count` — сколько акций, облигаций или долей ввёл игрок.
 */
export function outcomeOf(game: PublicGame, me: PlayerState, count: number): Preview | null {
  const pending = game.pending;
  if (!pending || game.phase !== 'deal' || game.pendingResolved) return null;
  const card = pending.card;
  if (pending.deck === 'ventures' && 'income' in card) {
    const pay = count * card.cost;
    if (count < 1 || pay > me.cash) return null;
    const income = count * card.income;
    return {
      pay, loan: 0, cashAfter: me.cash - pay,
      flow: [me.outerIncome, me.outerIncome + income], passive: [0, 0], expenses: [0, 0],
      outer: [me.outerIncome, me.outerIncome + income], risky: card.odds !== undefined,
    };
  }
  if (pending.deck === 'everyday') {
    const c = pending.card;
    const amount = everydayAmount(content, me, c);
    if (c.kind === 'insurance') return preview(me, 0, (p) => p.policies.push({ risk: c.risk, premium: amount }), false);
    if (c.kind === 'training') {
      const saving = trainingSaving(content, me, c);
      return preview(me, amount, (p) => { p.savings += saving; }, false);
    }
    return null;
  }
  if (!('kind' in card)) return null;
  switch (card.kind) {
    case 'asset':
      return preview(me, card.down, (p) => p.assets.push({
        id: 'preview', cardId: card.id, assetType: card.assetType, title: card.title,
        cost: card.cost, down: card.down, mortgage: card.cost - card.down, flow: card.flow,
      }), true);
    case 'bond':
      if (count < 1) return null;
      return preview(me, count * card.price, (p) => p.bonds.push({
        id: 'preview', cardId: card.id, title: card.title, count, price: card.price, coupon: card.coupon,
      }), false);
    case 'stock':
      if (count < 1) return null;
      return preview(me, count * card.price, () => {}, false);
    default:
      return null;
  }
}

const change = ([from, to]: [number, number]) => (from === to ? money(to) : `${money(from)} → ${money(to)}`);

/** Блок «Если купить» над кнопками решения. */
export function Outcome({ outcome }: { outcome: Preview }) {
  const rows: [string, string, string?][] = [];
  if (outcome.pay > 0) rows.push(['Отдать сейчас', money(outcome.pay)]);
  if (outcome.loan > 0) {
    const payment = Math.round(outcome.loan * content.rules.loanRate);
    rows.push(['В кредит', `${money(outcome.loan)}, платёж ${money(payment)} в период`, 'warn']);
  }
  rows.push(['Останется наличных', money(outcome.cashAfter)]);
  if (outcome.outer) {
    rows.push([outcome.risky ? 'Доход, если проект взлетит' : 'Доход за период', change(outcome.outer), 'good']);
  } else {
    const [from, to] = outcome.flow;
    if (from !== to) rows.push(['Поток за период', `${signed(from)} → ${signed(to)}`, to > from ? 'good' : 'warn']);
    if (outcome.passive[0] !== outcome.passive[1]) rows.push(['Пассивный доход', change(outcome.passive), 'good']);
    if (outcome.expenses[0] !== outcome.expenses[1]) rows.push(['Расходы', change(outcome.expenses), outcome.expenses[1] < outcome.expenses[0] ? 'good' : 'warn']);
  }
  const passiveShare = outcome.expenses[1] > 0 ? Math.min(100, Math.floor((outcome.passive[1] / outcome.expenses[1]) * 100)) : 0;
  return (
    <section className="outcome" aria-label="Что изменится после решения">
      <h3>Если согласиться</h3>
      <dl>
        {rows.map(([k, v, tone]) => (
          <div key={k} className={tone ? `outcome-${tone}` : undefined}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {!outcome.outer && outcome.passive[0] !== outcome.passive[1] && (
        <p className="muted">Пассивный доход покроет {passiveShare}% расходов.{passiveShare >= 100 ? ' Это выход из «Круга забот».' : ''}</p>
      )}
    </section>
  );
}
