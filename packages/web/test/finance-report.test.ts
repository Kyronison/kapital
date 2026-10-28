import { defaultContent } from '@kapital/content';
import { createGame, loanPayment, passiveIncome, gigIncome, professionOf, totalExpenses } from '@kapital/engine';
import { describe, expect, it } from 'vitest';
import { financeReport } from '../src/finance-report.js';

const content = defaultContent;

function rich() {
  const s = createGame(content, [{ id: 'p1', name: 'Игрок', professionId: 'developer' }], 7);
  const p = s.players[0]!;
  p.children = 2;
  p.bankLoan = 3000;
  p.deposit = 1000;
  p.savings = 100;
  p.assets.push({ id: 'a1', cardId: 'x', assetType: 'studio', title: 'Студия', cost: 50000, down: 5000, mortgage: 45000, flow: 400 });
  p.stocks.push({ ticker: 'BANK', shares: 100, avgPrice: 20, dividend: 1 });
  p.bonds.push({ id: 'b1', cardId: 'y', title: 'ОФЗ', count: 3, price: 1000, coupon: 10 });
  p.gigs = [{ title: 'Фриланс', amount: 300, paydaysLeft: 2 }];
  p.policies.push({ risk: 'health', premium: 50 } as never);
  p.subscriptions.push({ cardId: 'z', title: 'Телевизор в рассрочку', amount: 80, paydaysLeft: 3 } as never);
  return p;
}

describe('финансовый отчёт', () => {
  it('итоги доходов и расходов совпадают с движком', () => {
    const p = rich();
    const r = financeReport(content, p);
    expect(r.income.total).toBe(professionOf(content, p).salary + gigIncome(p) + passiveIncome(content, p));
    expect(r.expenses.total).toBe(totalExpenses(content, p));
    expect(r.expenses.groups.flatMap((g) => g.lines).find((l) => l.key === 'bank')?.amount).toBe(loanPayment(content, p));
  });

  it('пассивы: долги профессии, ипотеки и кредит банка', () => {
    const p = rich();
    const prof = professionOf(content, p);
    const r = financeReport(content, p);
    expect(r.liabilities.total).toBe(prof.liabilities.reduce((s, l) => s + l.amount, 0) + 45000 + 3000);
    expect(r.assets.total).toBe(p.cash + 1000 + 50000 + 2000 + 3000);
  });

  it('в увольнение зарплата не входит в доходы, а пустой пассивный доход объясняется', () => {
    const s = createGame(content, [{ id: 'p1', name: 'Игрок', professionId: 'courier' }], 7);
    const p = s.players[0]!;
    p.layoffPaydays = 2;
    const r = financeReport(content, p);
    expect(r.income.total).toBe(0);
    expect(r.income.groups[1]?.empty).toBeTruthy();
  });
});
