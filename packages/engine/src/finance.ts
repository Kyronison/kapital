import type { Content, Profession } from '@kapital/content';
import type { PlayerState } from './types.js';

export function professionOf(content: Content, player: PlayerState): Profession {
  const p = content.professions.find((x) => x.id === player.professionId);
  if (!p) throw new Error(`Неизвестная профессия: ${player.professionId}`);
  return p;
}

export function passiveIncome(player: PlayerState): number {
  return player.assets.reduce((sum, a) => sum + a.flow, 0);
}

export function loanPayment(content: Content, player: PlayerState): number {
  return Math.round(player.bankLoan * content.rules.loanRate);
}

/** Расходы без платежа по банковскому кредиту. */
export function baseExpenses(content: Content, player: PlayerState): number {
  const prof = professionOf(content, player);
  const e = prof.expenses;
  return e.taxes + e.housing + e.car + e.loans + e.other + player.children * prof.perChild;
}

export function totalExpenses(content: Content, player: PlayerState): number {
  return baseExpenses(content, player) + loanPayment(content, player);
}

/** Денежный поток за период, если зарплата приходит. */
export function cashflow(content: Content, player: PlayerState): number {
  return professionOf(content, player).salary + passiveIncome(player) - totalExpenses(content, player);
}

/** Максимальный общий долг перед банком: платежи не больше доли положительного потока. */
export function loanLimit(content: Content, player: PlayerState): number {
  const { loanRate, loanCapShare, loanStep } = content.rules;
  const flow = professionOf(content, player).salary + passiveIncome(player) - baseExpenses(content, player);
  const raw = (loanCapShare * Math.max(0, flow)) / loanRate;
  return Math.floor(raw / loanStep) * loanStep;
}

export function availableLoan(content: Content, player: PlayerState): number {
  return Math.max(0, loanLimit(content, player) - player.bankLoan);
}

export function hasEscaped(content: Content, player: PlayerState): boolean {
  return passiveIncome(player) >= totalExpenses(content, player);
}

export function roundUpToStep(amount: number, step: number): number {
  return Math.ceil(amount / step) * step;
}
