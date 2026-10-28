import type { Content, Effect, EverydayCard, Profession } from '@kapital/content';
import type { PlayerState } from './types.js';

export function professionOf(content: Content, player: PlayerState): Profession {
  const p = content.professions.find((x) => x.id === player.professionId);
  if (!p) throw new Error(`Неизвестная профессия: ${player.professionId}`);
  return p;
}

/** Доход вклада за период. */
export function depositIncome(content: Content, player: PlayerState): number {
  return Math.round(player.deposit * content.rules.depositRate);
}

/** Купоны облигаций за период. */
export function bondIncome(player: PlayerState): number {
  return player.bonds.reduce((sum, b) => sum + b.count * b.coupon, 0);
}

/** Дивиденды акций за период. */
export function dividendIncome(player: PlayerState): number {
  return player.stocks.reduce((sum, h) => sum + h.shares * (h.dividend ?? 0), 0);
}

export function passiveIncome(content: Content, player: PlayerState): number {
  return player.assets.reduce((sum, a) => sum + a.flow, 0) + depositIncome(content, player) + bondIncome(player) +
    dividendIncome(player);
}

/** Подработки за период: приходят вместе с зарплатой, пассивным доходом не считаются. */
export function gigIncome(player: PlayerState): number {
  return (player.gigs ?? []).reduce((sum, g) => sum + g.amount, 0);
}

/** Сумма последствия для игрока: доля зарплаты, округлённая до 10 К, или точная сумма. */
export function effectAmount(content: Content, player: PlayerState, effect: { share?: number; amount?: number }): number {
  if (effect.amount !== undefined) return effect.amount;
  return Math.round(((effect.share ?? 0) * professionOf(content, player).salary) / 10) * 10;
}

/**
 * Ожидаемая цена последствий в капах: сколько игрок в среднем получит (плюс) или отдаст (минус).
 * Нужна боту и подсказкам, чтобы сравнивать варианты дилемм. `paydaysLeft` — сколько зарплат ещё впереди.
 */
export function effectsValue(content: Content, player: PlayerState, effects: Effect[], paydaysLeft = 20): number {
  let sum = 0;
  for (const e of effects) {
    switch (e.kind) {
      case 'cash': sum += effectAmount(content, player, e); break;
      case 'monthly': sum -= effectAmount(content, player, e) * e.paydays; break;
      case 'gig': sum += effectAmount(content, player, e) * e.paydays; break;
      case 'saving': sum += effectAmount(content, player, e) * paydaysLeft; break;
      case 'skipSalary': sum -= professionOf(content, player).salary * e.paydays; break;
      case 'later': {
        const f = content.followUps.find((x) => x.id === e.event);
        if (f) sum += effectsValue(content, player, f.effects, paydaysLeft);
        break;
      }
      case 'gamble': {
        const chance = (7 - e.odds) / 6;
        sum += chance * effectsValue(content, player, e.win, paydaysLeft) + (1 - chance) * effectsValue(content, player, e.lose, paydaysLeft);
        break;
      }
    }
  }
  return sum;
}

/** Доходность сделки за период: поток на вложенные деньги. */
export function roi(flow: number, invested: number): number {
  return invested > 0 ? flow / invested : 0;
}

export function loanPayment(content: Content, player: PlayerState): number {
  return Math.round(player.bankLoan * content.rules.loanRate);
}

/** Прочие расходы после тренингов: ниже нуля не опускаются. */
export function otherExpenses(content: Content, player: PlayerState): number {
  return Math.max(0, professionOf(content, player).expenses.other - player.savings);
}

/** Подписки и взносы по полисам за период. */
export function extraExpenses(player: PlayerState): number {
  return player.subscriptions.reduce((sum, x) => sum + x.amount, 0) +
    player.policies.reduce((sum, x) => sum + x.premium, 0);
}

/** Расходы без платежа по банковскому кредиту. */
export function baseExpenses(content: Content, player: PlayerState): number {
  const prof = professionOf(content, player);
  const e = prof.expenses;
  return e.taxes + e.housing + e.car + e.loans + otherExpenses(content, player) +
    player.children * prof.perChild + extraExpenses(player);
}

/** Сумма карты «Будней» для игрока: доля его зарплаты, округлённая до 10 К. */
export function everydayAmount(content: Content, player: PlayerState, card: EverydayCard): number {
  const share = 'share' in card ? card.share : 0;
  return Math.max(10, Math.round((share * professionOf(content, player).salary) / 10) * 10);
}

/** На сколько тренинг снизит расходы за период. */
export function trainingSaving(content: Content, player: PlayerState, card: EverydayCard & { kind: 'training' }): number {
  return Math.round((card.saving * professionOf(content, player).salary) / 10) * 10;
}

export function totalExpenses(content: Content, player: PlayerState): number {
  return baseExpenses(content, player) + loanPayment(content, player);
}

/** Денежный поток за период, если зарплата приходит. */
export function cashflow(content: Content, player: PlayerState): number {
  return professionOf(content, player).salary + gigIncome(player) + passiveIncome(content, player) - totalExpenses(content, player);
}

/** Максимальный общий долг перед банком: платежи не больше доли положительного потока. */
export function loanLimit(content: Content, player: PlayerState): number {
  const { loanRate, loanCapShare, loanStep } = content.rules;
  const flow = professionOf(content, player).salary + passiveIncome(content, player) - baseExpenses(content, player);
  const raw = (loanCapShare * Math.max(0, flow)) / loanRate;
  return Math.floor(raw / loanStep) * loanStep;
}

export function availableLoan(content: Content, player: PlayerState): number {
  return Math.max(0, loanLimit(content, player) - player.bankLoan);
}

export function hasEscaped(content: Content, player: PlayerState): boolean {
  return passiveIncome(content, player) >= totalExpenses(content, player);
}

export function roundUpToStep(amount: number, step: number): number {
  return Math.ceil(amount / step) * step;
}
