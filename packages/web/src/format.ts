import { defaultContent as content, type AssetType } from '@kapital/content';
import type { GameEvent } from '@kapital/engine';

const nf = new Intl.NumberFormat('ru-RU');
export const money = (n: number) => `${nf.format(Math.round(n))} К`;
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
  venture: 'Инвестиция',
  dream: 'Мечта',
  lawsuit: 'Иск',
  audit: 'Проверка',
  crisis: 'Кризис',
};

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
    case 'turn_started': return `Ходит ${who}`;
    case 'game_finished': return 'Партия окончена';
  }
}

export const DECK_TITLES: Record<string, string> = {
  smallDeals: 'Шанс',
  bigDeals: 'Проект',
  market: 'Новости рынка',
  temptations: 'Соблазн',
  ventures: 'Инвестиция',
};

/** Рубашка колоды. */
export const DECK_BACKS: Record<string, string> = {
  smallDeals: 'decks/small.webp',
  bigDeals: 'decks/big.webp',
  market: 'decks/market.webp',
  temptations: 'decks/temptation.webp',
  ventures: 'decks/venture.webp',
};

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
