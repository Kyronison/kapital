import type { Content } from '@kapital/content';
import {
  availableLoan, depositIncome, loanPayment, otherExpenses, professionOf, type PlayerState,
} from '@kapital/engine';
import { ASSET_TITLES, money, percent, RISK_TITLES } from './format.js';

/** Строка отчёта: одна статья со своей суммой и пояснением, откуда она взялась. */
export interface ReportLine {
  key: string;
  icon: string;
  label: string;
  amount: number;
  note?: string;
  /** Статья сейчас не действует (зарплата в увольнении): в сумму не входит. */
  off?: boolean;
}

export interface ReportGroup {
  title: string;
  hint?: string;
  /** Что показать, пока статей нет: группа важна и пустой. */
  empty?: string;
  lines: ReportLine[];
  total: number;
}

export type ReportSectionId = 'income' | 'expenses' | 'assets' | 'liabilities';

export interface ReportSection {
  id: ReportSectionId;
  title: string;
  icon: string;
  /** Что это за раздел, одной фразой для новичка. */
  lead: string;
  groups: ReportGroup[];
  total: number;
}

const group = (title: string, lines: ReportLine[], hint?: string, empty?: string): ReportGroup => ({
  title, hint, empty, lines, total: lines.reduce((s, l) => s + (l.off ? 0 : l.amount), 0),
});

const section = (id: ReportSectionId, title: string, icon: string, lead: string, groups: ReportGroup[]): ReportSection => {
  const kept = groups.filter((g) => g.lines.length > 0 || g.empty);
  return { id, title, icon, lead, groups: kept, total: kept.reduce((s, g) => s + g.total, 0) };
};

const left = (n: number) => `ещё ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'период' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'периода' : 'периодов'}`;

/**
 * Финансовый отчёт игрока по статьям. Итоги доходов и расходов совпадают с движком:
 * доходы = зарплата + подработки + пассивный доход, расходы = totalExpenses.
 */
export function financeReport(content: Content, p: PlayerState): Record<ReportSectionId, ReportSection> {
  const prof = professionOf(content, p);
  const e = prof.expenses;
  const { loanRate, depositRate } = content.rules;

  const income = section('income', 'Доходы', 'ui-income', 'Деньги, которые приходят каждый период, в день зарплаты.', [
    group('Активный доход', [
      {
        key: 'salary', icon: 'cell-payday', label: 'Зарплата', amount: prof.salary,
        note: p.layoffPaydays > 0 ? `увольнение: не придёт ${left(p.layoffPaydays)}` : prof.title, off: p.layoffPaydays > 0,
      },
      ...(p.gigs ?? []).map((g, i) => ({ key: `gig-${i}`, icon: 'ui-income', label: g.title, amount: g.amount, note: `подработка, ${left(g.paydaysLeft)}` })),
    ], 'Пока вы работаете'),
    group('Пассивный доход', [
      ...p.assets.map((a) => ({ key: a.id, icon: `asset-${a.assetType}`, label: a.title, amount: a.flow, note: ASSET_TITLES[a.assetType] })),
      ...p.stocks.filter((s) => s.dividend).map((s) => ({
        key: `div-${s.ticker}`, icon: `stock-${s.ticker.toLowerCase()}`, label: `Дивиденды ${s.ticker}`,
        amount: s.shares * (s.dividend ?? 0), note: `${s.shares} шт. × ${money(s.dividend ?? 0)}`,
      })),
      ...p.bonds.map((b) => ({ key: b.id, icon: 'ui-bond', label: b.title, amount: b.count * b.coupon, note: `купон: ${b.count} шт. × ${money(b.coupon)}` })),
      ...(p.deposit > 0
        ? [{ key: 'deposit', icon: 'ui-deposit', label: 'Проценты по вкладу', amount: depositIncome(content, p), note: `${percent(depositRate)} от ${money(p.deposit)}` }]
        : []),
    ], 'Приносят активы, без вашей работы', 'Пока нет. Купите актив на клетке «Возможность», и его доход появится здесь.'),
  ]);

  const expenses = section('expenses', 'Расходы', 'ui-expense', 'Деньги, которые уходят каждый период, в тот же день зарплаты.', [
    group('Жизнь и семья', [
      { key: 'taxes', icon: 'ui-expense', label: 'Налоги', amount: e.taxes },
      { key: 'housing', icon: 'ui-key', label: 'Жильё', amount: e.housing, note: 'платёж за своё жильё' },
      ...(e.car > 0 ? [{ key: 'car', icon: 'ui-spend-monthly', label: 'Машина', amount: e.car, note: 'автокредит и содержание' }] : []),
      ...(e.loans > 0 ? [{ key: 'loans', icon: 'ui-spend-monthly', label: 'Кредитные карты и займы', amount: e.loans }] : []),
      {
        key: 'other', icon: 'ui-spend-once', label: 'Прочие расходы', amount: otherExpenses(content, p),
        note: p.savings > 0 ? `${money(e.other)} − ${money(p.savings)} за тренинги` : 'еда, одежда, связь',
      },
      ...(p.children > 0
        ? [{ key: 'children', icon: 'ui-family', label: 'Дети', amount: p.children * prof.perChild, note: `${p.children} × ${money(prof.perChild)}` }]
        : []),
    ]),
    group('Долг банку', p.bankLoan > 0
      ? [{ key: 'bank', icon: 'ui-bank', label: 'Платёж по кредиту банка', amount: loanPayment(content, p), note: `${percent(loanRate)} от ${money(p.bankLoan)}` }]
      : []),
    group('Страховки и рассрочки', [
      ...p.policies.map((x) => ({
        key: `policy-${x.risk}`, icon: `ui-insurance-${x.risk === 'health' ? 'life' : 'property'}`, label: RISK_TITLES[x.risk], note: 'страховой взнос', amount: x.premium,
      })),
      ...p.subscriptions.map((x, i) => ({ key: `sub-${i}`, icon: 'ui-spend-monthly', label: x.title, amount: x.amount, note: left(x.paydaysLeft) })),
    ]),
  ]);

  const assets = section('assets', 'Активы', 'ui-wallet', 'Что у вас есть. Настоящий актив приносит деньги каждый период.', [
    group('Деньги', [
      { key: 'cash', icon: 'ui-wallet', label: 'Наличные', amount: p.cash },
      ...(p.deposit > 0 ? [{ key: 'deposit', icon: 'ui-deposit', label: 'Вклад', amount: p.deposit, note: `приносит +${money(depositIncome(content, p))}` }] : []),
    ]),
    group('Недвижимость и бизнес', p.assets.map((a) => ({
      key: a.id, icon: `asset-${a.assetType}`, label: a.title, amount: a.cost,
      note: `приносит ${a.flow >= 0 ? '+' : '−'}${money(Math.abs(a.flow))}${a.mortgage > 0 ? `, взнос ${money(a.down)}` : ''}`,
    })), 'По цене покупки'),
    group('Ценные бумаги', [
      ...p.stocks.map((s) => ({
        key: `stock-${s.ticker}`, icon: `stock-${s.ticker.toLowerCase()}`, label: `Акции ${s.ticker}`, amount: Math.round(s.shares * s.avgPrice),
        note: `${s.shares} шт. по ${money(s.avgPrice)}`,
      })),
      ...p.bonds.map((b) => ({ key: b.id, icon: 'ui-bond', label: b.title, amount: b.count * b.price, note: `${b.count} шт. по ${money(b.price)}` })),
    ], 'По цене покупки'),
  ]);

  const liabilities = section('liabilities', 'Пассивы', 'ui-bank', 'Ваши долги. За каждый из них вы платите в расходах.', [
    group('Долги профессии', prof.liabilities.map((l, i) => ({ key: `prof-${i}`, icon: 'ui-loan-take', label: l.title, amount: l.amount })),
      'Квартира и машина в кредит: денег не приносят, поэтому не активы'),
    group('Ипотеки по активам', p.assets.filter((a) => a.mortgage > 0).map((a) => ({
      key: `mortgage-${a.id}`, icon: `asset-${a.assetType}`, label: `Ипотека: ${a.title}`, amount: a.mortgage, note: 'уже учтена в доходе актива',
    }))),
    group('Кредит банка', [
      { key: 'bank', icon: 'ui-bank', label: 'Кредит банка', amount: p.bankLoan, note: `можно взять ещё ${money(availableLoan(content, p))}` },
    ]),
  ]);

  return { income, expenses, assets, liabilities };
}
