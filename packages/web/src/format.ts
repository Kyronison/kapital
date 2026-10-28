import type { AssetType, EverydayCard, Risk } from '@kapital/content';
import { content } from './content.js';
import type { GameEvent } from '@kapital/engine';

const nf = new Intl.NumberFormat('ru-RU');
export const money = (n: number) => `${nf.format(Math.round(n))} К`;
export const percent = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString('ru-RU')}%`;
export const signed = (n: number) => `${n >= 0 ? '+' : '−'}${nf.format(Math.abs(Math.round(n)))} К`;

export const professionTitle = (id: string | null) => content.professions.find((p) => p.id === id)?.title ?? 'Случайная';
export const dreamTitle = (id: string | null) => content.dreams.find((d) => d.id === id)?.title ?? 'Случайная';

export const CELL_TITLES: Record<string, string> = {
  opportunity: 'Возможность',
  market: 'Новости рынка',
  temptation: 'Соблазн',
  charity: 'Помощь',
  baby: 'Пополнение',
  layoff: 'Сокращение',
  everyday: 'Будни',
  venture: 'Инвестиция',
  dream: 'Мечта',
  lawsuit: 'Иск',
  audit: 'Проверка',
  crisis: 'Кризис',
};

/** Короткие подписи для маленьких клеток на телефоне: полное название туда не помещается. */
export const CELL_SHORT: Record<string, string> = {
  opportunity: 'Сделка',
  market: 'Рынок',
  temptation: 'Соблазн',
  charity: 'Помощь',
  baby: 'Ребёнок',
  layoff: 'Сокращ.',
  everyday: 'Будни',
  venture: 'Проект',
  dream: 'Мечта',
  lawsuit: 'Иск',
  audit: 'Проверка',
  crisis: 'Кризис',
};

const share = (x: number) => `${Math.round(x * 100)}%`;

/** Что происходит, когда фишка встаёт на клетку. Числа берём из правил текущего стола. */
export function cellHelp(cell: string): string {
  const r = content.rules;
  switch (cell) {
    case 'opportunity': return 'Вы выбираете колоду: «Шанс» — малые сделки (акции, комнаты, гаражи), «Проект» — крупные (дома, бизнес). Покупать или нет, решаете сами; не хватает денег — можно взять кредит.';
    case 'market': return 'Новости рынка. Либо покупатель предлагает цену за определённый актив, и все его владельцы могут продать, даже не в свой ход. Либо владельцы такого актива платят за ремонт.';
    case 'temptation': return 'Спонтанная покупка: сумма с карточки сразу списывается с наличных. Если денег не хватает, банк выдаст кредит.';
    case 'charity': return `Можно пожертвовать ${share(r.charityShare)} дохода и следующие ${r.charityTurns} хода бросать два кубика, чтобы чаще попадать на сделки. Можно отказаться.`;
    case 'baby': return `В семье пополнение: расходы растут на сумму «на ребёнка» вашей профессии. Детей не больше ${r.maxChildren}.`;
    case 'layoff': return `Сокращение: следующие ${r.layoffPaydays} зарплаты не придут. Ходить вы продолжаете, а пассивный доход идёт как обычно.`;
    case 'everyday': return 'Будни: обычная трата, неприятность (её оплатит полис, если он есть), подписка на несколько зарплат, неожиданный доход или предложение страховки и тренинга.';
    case 'venture': return 'Инвестиционный проект: покупаете доли, и они приносят доход каждый период. У рискованных проектов сразу бросают кубик: не повезло — вложение пропадает.';
    case 'dream': return 'Здесь продаются мечты. Купить можно только свою, если хватает наличных, и это победа.';
    case 'lawsuit': return `Судебный иск: вы отдаёте ${share(r.lawsuitShare)} наличных. Держите деньги в активах, а не на руках.`;
    case 'audit': return `Налоговая проверка: вы отдаёте ${share(r.auditShare)} наличных.`;
    case 'crisis': return 'Кризис: следующий доход «Свободного пути» не придёт.';
    default: return '';
  }
}

export const PAYDAY_HELP: Record<'inner' | 'outer', string> = {
  inner: 'Рубеж зарплаты: когда фишка проходит или встаёт сюда, приходит поток за период — зарплата плюс пассивный доход минус расходы.',
  outer: 'Рубеж дохода: когда фишка проходит или встаёт сюда, приходит доход «Свободного пути».',
};

/**
 * Картинка клетки поля из третьего набора. У одинаковых клеток картинки чередуются по номеру,
 * чтобы поле не выглядело однообразным. На клетке мечты — первая из мечт этой клетки.
 */
const CELL_ART: Record<string, number | string> = {
  opportunity: 8, market: 3, temptation: 2, everyday: 2, venture: 6,
  charity: 'charity', baby: 'baby', layoff: 'layoff', lawsuit: 'lawsuit', audit: 'audit', crisis: 'crisis',
};
export function cellArt(cell: string, i: number, circle: 'inner' | 'outer', dreams?: string[]): string | null {
  if (cell === 'dream') return dreams?.[0] ? `dreams/${dreams[0]}.webp` : null;
  if (cell === 'charity' && circle === 'outer') return 'cells/charity-outer.webp';
  const art = CELL_ART[cell];
  if (art === undefined) return null;
  return typeof art === 'number' ? `cells/${cell}-${(i % art) + 1}.webp` : `cells/${art}.webp`;
}

export const ASSET_TITLES: Record<AssetType, string> = {
  studio: 'Студия',
  room: 'Комната',
  garage: 'Гараж',
  vending: 'Автомат',
  fourplex: 'Дом на 4 квартиры',
  carwash: 'Автомойка',
  cafe: 'Кафе',
  complex: 'Жилой комплекс',
};

const cardTitle = (deck: string, id: string): string => {
  const list = (content as unknown as Record<string, { id: string; title: string }[]>)[deck] ?? [];
  return list.find((c) => c.id === id)?.title ?? id;
};

/** Что дала покупка: ищем карту по id в колодах сделок и проектов. */
function boughtText(cardId: string, price: number): string {
  const deal = [...content.smallDeals, ...content.bigDeals].find((c) => c.id === cardId);
  if (deal?.kind === 'asset') return `«${deal.title}», взнос ${money(price)}: пассивный доход ${signed(deal.flow)} за период`;
  if (deal?.kind === 'bond') {
    const count = Math.round(price / deal.price);
    return `облигации «${deal.title}», ${count} шт. за ${money(price)}: купоны ${signed(count * deal.coupon)} за период`;
  }
  if (deal?.kind === 'stock') return `${Math.round(price / deal.price)} акций «${deal.title}» за ${money(price)}: дохода не дают, заработать можно на продаже`;
  const venture = content.ventures.find((c) => c.id === cardId);
  if (venture) {
    const shares = Math.round(price / venture.cost);
    return `доли «${venture.title}», ${shares} шт. за ${money(price)}${venture.odds === undefined ? `: доход ${signed(shares * venture.income)} за период` : ''}`;
  }
  return `за ${money(price)}`;
}

const loanPaymentText = (amount: number) => money(Math.round(amount * content.rules.loanRate));

export function describe(e: GameEvent, name: (id: string) => string): string | null {
  const who = 'playerId' in e ? name(e.playerId) : '';
  switch (e.type) {
    case 'rolled': return `${who}: выпало ${e.dice.join(' + ')}`;
    case 'payday': return `${who}: ${e.salaryPaid ? 'зарплата' : 'без зарплаты'}, поток ${signed(e.amount)}`;
    case 'income': return `${who}: доход ${signed(e.amount)}`;
    case 'income_lost': return `${who}: доход пропал из-за кризиса`;
    case 'landed': return `${who} → ${CELL_TITLES[e.cell] ?? e.cell}`;
    case 'card_drawn': return `${who}: «${cardTitle(e.deck, e.cardId)}»`;
    case 'bought': return `${who} покупает ${boughtText(e.cardId, e.price)}`;
    case 'venture_rolled': return `${who}: на кубике ${e.roll} — ${e.success ? 'проект взлетел' : 'проект закрылся, вложение пропало'}`;
    case 'sold': return `${who} продаёт, выручка ${signed(e.proceeds)}`;
    case 'paid': return `${who} платит ${money(e.amount)}: ${e.reason}`;
    case 'loan_taken': return `${who} берёт кредит ${money(e.amount)}${e.forced ? ' (не хватило денег)' : ''}: расходы +${loanPaymentText(e.amount)} за период`;
    case 'loan_repaid': return `${who} гасит кредит ${money(e.amount)}: расходы −${loanPaymentText(e.amount)} за период`;
    case 'child_born': return `${who}: в семье пополнение, детей ${e.children}`;
    case 'laid_off': return `${who} попадает под сокращение: зарплат не будет ещё ${content.rules.layoffPaydays}, пассивный доход идёт`;
    case 'donated': return `${who} жертвует ${money(e.amount)}: ${content.rules.charityTurns} хода с двумя кубиками`;
    case 'asset_liquidated': return `${who} распродаёт актив за ${money(e.proceeds)}`;
    case 'bankrupt': return `${who} банкротится и начинает заново`;
    case 'escaped': return `${who} выходит из «Круга забот»! Доход на «Свободном пути» ${money(e.outerIncome)}`;
    case 'crisis': return `${who}: кризис, следующий доход пропадёт`;
    case 'won': return `${who} побеждает: ${e.by === 'dream' ? 'мечта куплена' : 'доход вырос до цели'}`;
    case 'covered': return `${who}: полис покрыл ${money(e.amount)}`;
    case 'insured': return `${who} оформляет ${RISK_TITLES[e.risk].toLowerCase()}, взнос ${money(e.premium)} за период`;
    case 'policy_cancelled': return `${who} отказывается от полиса`;
    case 'subscribed': return `${who}: «${e.title}», ${money(e.amount)} за период ещё ${e.paydays} зарплаты`;
    case 'trained': return `${who} учится за ${money(e.cost)}: расходы ниже на ${money(e.saving)}`;
    case 'received': return `${who} получает ${money(e.amount)}: ${e.reason}`;
    case 'deposited': return `${who} кладёт на вклад ${money(e.amount)}: доход ${signed(Math.round(e.amount * content.rules.depositRate))} за период`;
    case 'withdrawn': return `${who} снимает со вклада ${money(e.amount)}${e.forced ? ' (не хватило денег)' : ''}`;
    case 'bond_sold': return `${who} возвращает облигации за ${money(e.proceeds)}`;
    case 'turn_started': return `Ходит ${who}`;
    case 'game_finished': return 'Партия окончена';
  }
}

export const RISK_TITLES: Record<Risk, string> = {
  health: 'Полис здоровья',
  property: 'Полис имущества',
};

export const DECK_TITLES: Record<string, string> = {
  smallDeals: 'Шанс',
  bigDeals: 'Проект',
  market: 'Новости рынка',
  temptations: 'Соблазн',
  everyday: 'Будни',
  ventures: 'Инвестиция',
};

/** Рубашка колоды. */
export const DECK_BACKS: Record<string, string> = {
  smallDeals: 'decks/small.webp',
  bigDeals: 'decks/big.webp',
  market: 'decks/market.webp',
  temptations: 'decks/temptation.webp',
  everyday: 'decks/everyday.webp',
  ventures: 'decks/venture.webp',
};

/** Картинки карт «Будней»: своя у вида карты, у некоторых карт — особая. */
const EVERYDAY_KIND_ART: Record<EverydayCard['kind'], string> = {
  spend: 'everyday/spend-once.webp',
  monthly: 'everyday/spend-monthly.webp',
  trouble: 'everyday/trouble-health.webp',
  insurance: 'everyday/insurance-life.webp',
  training: 'everyday/training.webp',
  windfall: 'everyday/bonus.webp',
};
const EVERYDAY_CARD_ART: Record<string, string> = {
  'ev-spend-2': 'everyday/gift.webp',
  'ev-spend-3': 'everyday/repair.webp',
  'ev-property-1': 'everyday/trouble-property.webp',
  'ev-property-2': 'everyday/trouble-property.webp',
  'ev-property-3': 'everyday/trouble-property.webp',
  'ev-property-4': 'everyday/repair.webp',
  'ev-ins-property': 'everyday/insurance-property.webp',
  'ev-training-2': 'everyday/consultation.webp',
  'ev-windfall-2': 'everyday/tax-refund.webp',
};
export const everydayArt = (c: EverydayCard) => EVERYDAY_CARD_ART[c.id] ?? EVERYDAY_KIND_ART[c.kind];

/** Клетки без карты: что произошло и какая картинка. */
export const SITUATIONS: Record<string, { art: string; text: string }> = {
  charity: {
    art: 'deals/charity.webp',
    text: `Можно пожертвовать ${Math.round(content.rules.charityShare * 100)}% дохода и следующие ${content.rules.charityTurns} хода бросать два кубика.`,
  },
  baby: { art: 'deals/baby.webp', text: 'В семье пополнение: расходы за период выросли.' },
  layoff: { art: 'deals/layoff.webp', text: `Две ближайшие зарплаты не придут. Пассивный доход продолжает работать.` },
  lawsuit: { art: 'deals/lawsuit.webp', text: `Судебный иск забирает ${Math.round(content.rules.lawsuitShare * 100)}% наличных.` },
  audit: { art: 'deals/audit.webp', text: `Налоговая проверка забирает ${Math.round(content.rules.auditShare * 100)}% наличных.` },
  crisis: { art: 'deals/crisis.webp', text: 'Кризис: следующий доход «Свободного пути» не придёт.' },
};
