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

/**
 * Картинка клетки поля. У одинаковых клеток картинки чередуются по номеру клетки,
 * чтобы поле не выглядело однообразным. На клетке мечты — первая из мечт этой клетки.
 */
const CELL_ART: Record<string, string[]> = {
  opportunity: ['deals/cafe', 'deals/room', 'deals/vending', 'deals/carwash', 'deals/garage', 'deals/studio', 'deals/stock-up', 'deals/fourplex'],
  market: ['deals/market-offer', 'deals/stock-down', 'deals/stock-up'],
  temptation: ['deals/temptation'],
  everyday: ['everyday/spend-once', 'everyday/trouble-health'],
  charity: ['deals/charity'],
  baby: ['deals/baby'],
  layoff: ['deals/layoff'],
  venture: ['deals/venture', 'deals/complex', 'invest/dividends', 'invest/bonds', 'invest/stock-range'],
  lawsuit: ['deals/lawsuit'],
  audit: ['deals/audit'],
  crisis: ['deals/crisis'],
};
export function cellArt(cell: string, i: number, dreams?: string[]): string | null {
  if (cell === 'dream') return dreams?.[0] ? `dreams/${dreams[0]}.webp` : null;
  const list = CELL_ART[cell];
  return list ? `${list[i % list.length]}.webp` : null;
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

export function describe(e: GameEvent, name: (id: string) => string): string | null {
  const who = 'playerId' in e ? name(e.playerId) : '';
  switch (e.type) {
    case 'rolled': return `${who}: выпало ${e.dice.join(' + ')}`;
    case 'payday': return `${who}: ${e.salaryPaid ? 'зарплата' : 'без зарплаты'}, поток ${signed(e.amount)}`;
    case 'income': return `${who}: доход ${signed(e.amount)}`;
    case 'income_lost': return `${who}: доход пропал из-за кризиса`;
    case 'landed': return `${who} → ${CELL_TITLES[e.cell] ?? e.cell}`;
    case 'card_drawn': return `${who}: «${cardTitle(e.deck, e.cardId)}»`;
    case 'bought': return `${who} покупает за ${money(e.price)}`;
    case 'sold': return `${who} продаёт, выручка ${signed(e.proceeds)}`;
    case 'paid': return `${who} платит ${money(e.amount)}: ${e.reason}`;
    case 'loan_taken': return `${who} берёт кредит ${money(e.amount)}${e.forced ? ' (не хватило денег)' : ''}`;
    case 'loan_repaid': return `${who} гасит кредит ${money(e.amount)}`;
    case 'child_born': return `${who}: в семье пополнение, детей ${e.children}`;
    case 'laid_off': return `${who} попадает под сокращение: две зарплаты не придут`;
    case 'donated': return `${who} жертвует ${money(e.amount)}: три хода с двумя кубиками`;
    case 'asset_liquidated': return `${who} распродаёт актив за ${money(e.proceeds)}`;
    case 'bankrupt': return `${who} банкротится и начинает заново`;
    case 'escaped': return `${who} выходит из «Круга забот»! Доход на «Свободном пути» ${money(e.outerIncome)}`;
    case 'crisis': return `${who}: кризис, следующий доход пропадёт`;
    case 'won': return `${who} побеждает: ${e.by === 'dream' ? 'мечта куплена' : 'доход удвоен'}`;
    case 'covered': return `${who}: полис покрыл ${money(e.amount)}`;
    case 'insured': return `${who} оформляет ${RISK_TITLES[e.risk].toLowerCase()}, взнос ${money(e.premium)} за период`;
    case 'policy_cancelled': return `${who} отказывается от полиса`;
    case 'subscribed': return `${who}: «${e.title}», ${money(e.amount)} за период ещё ${e.paydays} зарплаты`;
    case 'trained': return `${who} учится за ${money(e.cost)}: расходы ниже на ${money(e.saving)}`;
    case 'received': return `${who} получает ${money(e.amount)}: ${e.reason}`;
    case 'deposited': return `${who} кладёт на вклад ${money(e.amount)}`;
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
