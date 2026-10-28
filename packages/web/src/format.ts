import type { AssetType, Effect, EverydayCard, NewsCard, Risk } from '@kapital/content';
import { content } from './content.js';
import { effectAmount, type GameEvent, type PlayerState } from '@kapital/engine';

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

/** Название на корешке билета: одно полное слово, без сокращений. */
export const CELL_NAMES: Record<string, string> = {
  opportunity: 'Сделка',
  market: 'Рынок',
  temptation: 'Соблазн',
  charity: 'Помощь',
  baby: 'Ребёнок',
  layoff: 'Сокращение',
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
    case 'market': return 'Новости рынка. Покупатель предлагает цену за определённый актив, и все его владельцы могут продать, даже не в свой ход. Или владельцы жилья платят за ремонт. Или выходит новость, которая на несколько ходов меняет цены акций, взносы по сделкам или покупателей.';
    case 'temptation': return 'Спонтанная покупка: сумма с карточки списывается с наличных. Крупную покупку можно взять в рассрочку на 4 зарплаты, но выйдет дороже. Если денег не хватает, банк выдаст кредит.';
    case 'charity': return `Можно пожертвовать ${share(r.charityShare)} дохода и следующие ${r.charityTurns} хода бросать два кубика, чтобы чаще попадать на сделки. Можно отказаться.`;
    case 'baby': return `В семье пополнение: расходы растут на сумму «на ребёнка» вашей профессии. Детей не больше ${r.maxChildren}.`;
    case 'layoff': return `Сокращение: следующие ${r.layoffPaydays} зарплаты не придут. Ходить вы продолжаете, а пассивный доход идёт как обычно.`;
    case 'everyday': return 'Будни: обычная трата, неприятность (её оплатит полис, если он есть), подписка, неожиданный доход, страховка и тренинг. Или жизненная ситуация с выбором: одолжить другу, взять подработку, рискнуть. У некоторых решений есть продолжение через несколько зарплат.';
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
 * Клетка поля из пятого набора: готовая плитка с рамкой цвета типа и полосой под подпись.
 * У одинаковых клеток плитки чередуются по номеру, чтобы поле не выглядело однообразным.
 */
const CELL_TILES: Record<string, number> = { opportunity: 4, market: 3, temptation: 2, everyday: 2, venture: 4 };
export function cellTile(cell: string, i: number, circle: 'inner' | 'outer'): string {
  if (cell === 'dream') return 'dream-frame';
  if (cell === 'charity' && circle === 'outer') return 'charity-outer';
  const count = CELL_TILES[cell];
  return count ? `${cell}-${(i % count) + 1}` : cell;
}

/** Картинка мечты для клетки-мечты: встаёт в окно золотой рамки. */
export function dreamArt(dreams?: string[]): string | null {
  return dreams?.[0] ? `dreams/${dreams[0]}.webp` : null;
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
function boughtText(cardId: string, price: number, count?: number): string {
  const deal = [...content.smallDeals, ...content.bigDeals].find((c) => c.id === cardId);
  // поток и цена на карте могли измениться из-за новости, поэтому для жилья и бизнеса показываем только взнос
  if (deal?.kind === 'asset') return `«${deal.title}», взнос ${money(price)}`;
  if (deal?.kind === 'bond') {
    const n = count ?? Math.round(price / deal.price);
    return `облигации «${deal.title}», ${n} шт. за ${money(price)}: купоны ${signed(n * deal.coupon)} за период`;
  }
  if (deal?.kind === 'stock') {
    const n = count ?? Math.round(price / deal.price);
    const name = `«${TICKER_TITLES[deal.ticker] ?? deal.ticker}»`;
    return deal.dividend
      ? `${n} акций ${name} за ${money(price)}: дивиденды ${signed(n * deal.dividend)} за период`
      : `${n} акций ${name} за ${money(price)}: дохода не дают, заработать можно на продаже`;
  }
  const venture = content.ventures.find((c) => c.id === cardId);
  if (venture) {
    const shares = count ?? Math.round(price / venture.cost);
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
    case 'bought': return `${who} покупает ${boughtText(e.cardId, e.price, e.count)}`;
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
    case 'chose': return `${who} выбирает: ${e.label}`;
    case 'gambled': return `${who}: на кубике ${e.roll}, нужно ${e.odds}+ — ${e.success ? 'повезло' : 'не повезло'}`;
    case 'gig_started': return `${who}: «${e.title}», ${signed(e.amount)} к зарплате, ${times(e.paydays)}`;
    case 'follow_up': return `${who}: продолжение истории — ${e.title}`;
    case 'news': return `${who} открывает новость «${e.title}»: действует ${e.turns} хода`;
    case 'news_ended': return `Новость «${e.title}» больше не действует`;
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
  dilemma: 'everyday/consultation.webp',
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
  'ev-dilemma-friend-loan': 'everyday/gift.webp',
  'ev-dilemma-weekend-job': 'everyday/spend-once.webp',
  'ev-dilemma-car-noise': 'everyday/repair.webp',
  'ev-dilemma-evening-courses': 'everyday/training.webp',
  'ev-dilemma-fridge': 'everyday/repair.webp',
  'ev-dilemma-pyramid': 'deals/stock-down.webp',
  'ev-dilemma-jubilee': 'everyday/gift.webp',
  'ev-dilemma-dacha': 'everyday/trouble-property.webp',
  'ev-dilemma-lottery': 'everyday/bonus.webp',
  'ev-dilemma-promotion': 'everyday/bonus.webp',
  'ev-dilemma-courier-nights': 'everyday/spend-once.webp',
  'ev-dilemma-nurse-home': 'everyday/trouble-health.webp',
  'ev-dilemma-teacher-tutor': 'everyday/training.webp',
  'ev-dilemma-mechanic-box': 'deals/garage.webp',
  'ev-dilemma-developer-startup': 'deals/venture.webp',
  'ev-dilemma-lawyer-case': 'deals/lawsuit.webp',
  'ev-dilemma-surgeon-clinic': 'everyday/trouble-health.webp',
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

export const TICKER_TITLES: Record<string, string> = content.smallDeals.reduce<Record<string, string>>((acc, c) => {
  if (c.kind === 'stock') acc[c.ticker] = c.title.replace(/^Акции «(.+)» по .*$/, '$1');
  return acc;
}, {});

/** Картинка новости рынка: по тому, что она меняет. */
export function newsArt(card: NewsCard): string {
  const e = card.effect;
  switch (e.kind) {
    case 'stocks': return e.factor >= 1 ? 'deals/stock-up.webp' : 'deals/stock-down.webp';
    case 'down': return e.assetTypes.includes('studio') ? 'deals/fourplex.webp' : 'deals/carwash.webp';
    case 'offers': return 'deals/market-offer.webp';
    case 'temptations': return 'deals/temptation.webp';
  }
}

/** Последствия варианта простыми словами: «−1 500 К сразу», «+450 К к зарплате 4 раза». */
export function effectsText(p: PlayerState, effects: Effect[]): string {
  if (!effects.length) return 'ничего не меняется';
  return effects.map((e) => effectText(p, e)).join(', ');
}

/** «1 раз», «3 раза», «5 раз». */
const times = (n: number) => {
  const d = n % 10;
  const many = n % 100 >= 11 && n % 100 <= 14;
  return `${n} ${!many && d >= 2 && d <= 4 ? 'раза' : 'раз'}`;
};

/** «1 зарплату», «3 зарплаты», «5 зарплат». */
const paydays = (n: number) => {
  const d = n % 10;
  const many = n % 100 >= 11 && n % 100 <= 14;
  return `${n} ${many ? 'зарплат' : d === 1 ? 'зарплату' : d >= 2 && d <= 4 ? 'зарплаты' : 'зарплат'}`;
};

function effectText(p: PlayerState, e: Effect): string {
  switch (e.kind) {
    case 'cash': return `${signed(effectAmount(content, p, e))} сразу`;
    case 'monthly': return `${signed(-effectAmount(content, p, e))} в период, ${times(e.paydays)}`;
    case 'gig': return `${signed(effectAmount(content, p, e))} к зарплате, ${times(e.paydays)}`;
    case 'saving': return `расходы ${signed(-effectAmount(content, p, e))} навсегда`;
    case 'skipSalary': return `${paydays(e.paydays)} не придёт`;
    case 'later': return `продолжение через ${paydays(e.paydays)}`;
    case 'gamble': {
      const win = e.win.length ? effectsText(p, e.win) : 'ничего';
      const lose = e.lose.length ? effectsText(p, e.lose) : 'ничего';
      return `кубик: ${e.odds}+ — ${win}, иначе ${lose}`;
    }
  }
}
