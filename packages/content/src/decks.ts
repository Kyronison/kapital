import type {
  AssetCard, AssetType, BondCard, DealCard, ExpenseCard, MarketCard, OfferCard, StockCard, TemptationCard,
} from './types.js';

const asset = (
  id: string, assetType: AssetType, title: string, cost: number, down: number, flow: number,
): AssetCard => ({ id, kind: 'asset', assetType, title, cost, down, flow });

const TICKERS: Record<string, string> = {
  ENRG: 'Энергосеть',
  TECH: 'Технополис',
  FOOD: 'Продмаг',
  GOLD: 'Северное золото',
};

const stockPrices: [string, number][] = [
  ['ENRG', 5], ['ENRG', 10], ['ENRG', 15], ['ENRG', 20], ['ENRG', 30],
  ['TECH', 5], ['TECH', 10], ['TECH', 10], ['TECH', 25], ['TECH', 40],
  ['FOOD', 5], ['FOOD', 10], ['FOOD', 20], ['FOOD', 20], ['FOOD', 30],
  ['GOLD', 5], ['GOLD', 10], ['GOLD', 15], ['GOLD', 25], ['GOLD', 40], ['GOLD', 20],
];

const range = (ticker: string) => stockPrices.filter(([t]) => t === ticker).map(([, price]) => price);

const stocks: StockCard[] = stockPrices.map(([ticker, price], i) => ({
  id: `stock-${i + 1}`,
  kind: 'stock',
  ticker,
  title: `Акции «${TICKERS[ticker]}» по ${price} К`,
  price,
  low: Math.min(...range(ticker)),
  high: Math.max(...range(ticker)),
}));

const bonds: BondCard[] = [
  ['Облигации города', 30], ['Облигации энергосети', 40], ['Облигации застройщика', 50], ['Государственный заём', 30],
].map(([title, coupon], i) => ({ id: `bond-${i + 1}`, kind: 'bond', title: title as string, price: 1000, coupon: coupon as number }));

/** Колода «Шанс»: малые сделки с взносом до 6 000 К. */
export const smallDeals: DealCard[] = [
  ...stocks,
  ...bonds,
  asset('studio-1', 'studio', 'Студия у метро', 40000, 4000, 300),
  asset('studio-2', 'studio', 'Студия в новостройке', 45000, 5000, 400),
  asset('studio-3', 'studio', 'Студия после ремонта', 50000, 6000, 600),
  asset('studio-4', 'studio', 'Студия у университета', 45000, 4000, 500),
  asset('studio-5', 'studio', 'Студия от застройщика', 40000, 5000, 700),
  asset('studio-6', 'studio', 'Студия на окраине', 40000, 4000, 300),
  asset('studio-7', 'studio', 'Студия с арендатором', 50000, 5000, 500),
  asset('studio-8', 'studio', 'Студия в старом фонде', 45000, 6000, 400),
  asset('studio-9', 'studio', 'Студия у парка', 50000, 6000, 600),
  asset('studio-10', 'studio', 'Студия у вокзала', 45000, 5000, 700),
  asset('room-1', 'room', 'Комната в коммуналке', 20000, 2000, 200),
  asset('room-2', 'room', 'Комната у института', 25000, 3000, 350),
  asset('room-3', 'room', 'Комната в центре', 25000, 3000, 300),
  asset('room-4', 'room', 'Комната с мебелью', 20000, 2000, 250),
  asset('room-5', 'room', 'Комната в общежитии', 20000, 2000, 200),
  asset('room-6', 'room', 'Две комнаты в коммуналке', 25000, 3000, 350),
  asset('room-7', 'room', 'Комната у рынка', 20000, 3000, 250),
  asset('room-8', 'room', 'Комната под посуточную сдачу', 25000, 2000, 300),
  asset('room-9', 'room', 'Комната у завода', 20000, 2000, 200),
  asset('room-10', 'room', 'Комната с балконом', 25000, 3000, 300),
  asset('garage-1', 'garage', 'Гараж в кооперативе', 8000, 1000, 120),
  asset('garage-2', 'garage', 'Гараж у шиномонтажа', 8000, 1500, 220),
  asset('garage-3', 'garage', 'Бокс на парковке', 8000, 1000, 150),
  asset('garage-4', 'garage', 'Гараж с ямой', 8000, 1500, 180),
  asset('garage-5', 'garage', 'Кладовка в ЖК', 8000, 1000, 120),
  asset('garage-6', 'garage', 'Гараж под склад', 8000, 1500, 220),
  asset('garage-7', 'garage', 'Машиноместо', 8000, 1000, 150),
  asset('garage-8', 'garage', 'Гараж у дачи', 8000, 1500, 180),
  asset('garage-9', 'garage', 'Бокс в подземном паркинге', 8000, 1000, 120),
  asset('vending-1', 'vending', 'Кофейный автомат в бизнес-центре', 3000, 3000, 300),
  asset('vending-2', 'vending', 'Автомат со снеками в школе', 2500, 2500, 250),
  asset('vending-3', 'vending', 'Постамат для посылок', 3500, 3500, 400),
  asset('vending-4', 'vending', 'Аппарат с водой', 2500, 2500, 300),
  asset('vending-5', 'vending', 'Массажное кресло в ТЦ', 3000, 3000, 350),
  asset('vending-6', 'vending', 'Фотобудка', 3500, 3500, 350),
  asset('vending-7', 'vending', 'Зарядная станция для телефонов', 2500, 2500, 250),
  asset('vending-8', 'vending', 'Кофейный автомат в больнице', 3000, 3000, 400),
  asset('vending-9', 'vending', 'Аппарат с игрушками', 3500, 3500, 300),
];

/** Колода «Проект»: крупные сделки от 12 000 К. */
export const bigDeals: DealCard[] = [
  asset('fourplex-1', 'fourplex', 'Дом на 4 квартиры', 120000, 12000, 1200),
  asset('fourplex-2', 'fourplex', 'Таунхаус на 4 секции', 120000, 15000, 1500),
  asset('fourplex-3', 'fourplex', 'Дом на 4 квартиры у школы', 120000, 18000, 1800),
  asset('fourplex-4', 'fourplex', 'Дом на 4 квартиры с садом', 120000, 15000, 1200),
  asset('fourplex-5', 'fourplex', 'Дом под студенческую сдачу', 120000, 12000, 1500),
  asset('fourplex-6', 'fourplex', 'Дом на 4 квартиры у трассы', 120000, 18000, 1500),
  asset('fourplex-7', 'fourplex', 'Купеческий особняк', 120000, 15000, 1800),
  asset('fourplex-8', 'fourplex', 'Дом на 4 квартиры в пригороде', 120000, 12000, 1200),
  asset('fourplex-9', 'fourplex', 'Дом с мансардами', 120000, 18000, 1800),
  asset('fourplex-10', 'fourplex', 'Дом на 4 квартиры у реки', 120000, 15000, 1500),
  asset('carwash-1', 'carwash', 'Автомойка самообслуживания', 30000, 30000, 2400),
  asset('carwash-2', 'carwash', 'Автомойка у трассы', 35000, 35000, 3200),
  asset('carwash-3', 'carwash', 'Автомойка у ТЦ', 30000, 30000, 2800),
  asset('carwash-4', 'carwash', 'Автомойка с шиномонтажом', 35000, 35000, 3600),
  asset('carwash-5', 'carwash', 'Мойка для грузовиков', 35000, 35000, 2800),
  asset('carwash-6', 'carwash', 'Автомойка в спальном районе', 30000, 30000, 2400),
  asset('carwash-7', 'carwash', 'Портальная мойка', 35000, 35000, 3200),
  asset('carwash-8', 'carwash', 'Детейлинг-центр', 30000, 30000, 3600),
  asset('carwash-9', 'carwash', 'Автомойка у вокзала', 30000, 30000, 2800),
  asset('carwash-10', 'carwash', 'Автомойка на заправке', 35000, 35000, 2400),
  asset('cafe-1', 'cafe', 'Кофейня у бизнес-центра', 60000, 20000, 1600),
  asset('cafe-2', 'cafe', 'Пекарня в спальном районе', 60000, 25000, 2200),
  asset('cafe-3', 'cafe', 'Столовая у завода', 60000, 20000, 2800),
  asset('cafe-4', 'cafe', 'Модное кафе без парковки', 60000, 25000, -400),
  asset('cafe-5', 'cafe', 'Шаурмичная у метро', 60000, 20000, 2200),
  asset('cafe-6', 'cafe', 'Кафе-франшиза', 60000, 25000, 1600),
  asset('cafe-7', 'cafe', 'Ресторан на набережной', 60000, 25000, 2800),
  asset('cafe-8', 'cafe', 'Кафе в переулке', 60000, 20000, -400),
  asset('cafe-9', 'cafe', 'Бургерная у университета', 60000, 20000, 2200),
  asset('cafe-10', 'cafe', 'Чайная у парка', 60000, 25000, 1600),
  asset('complex-1', 'complex', 'Жилой комплекс на 40 квартир', 400000, 40000, 4000),
  asset('complex-2', 'complex', 'Апарт-отель', 400000, 50000, 5000),
  asset('complex-3', 'complex', 'Жилой комплекс у моря', 400000, 50000, 6000),
  asset('complex-4', 'complex', 'Доходный дом', 400000, 40000, 5000),
  asset('complex-5', 'complex', 'Общежитие для вахтовиков', 400000, 40000, 6000),
  asset('complex-6', 'complex', 'Жилой комплекс в пригороде', 400000, 50000, 4000),
  asset('complex-7', 'complex', 'Квартал таунхаусов', 400000, 50000, 5000),
  asset('complex-8', 'complex', 'Жилой комплекс у технопарка', 400000, 40000, 4000),
  asset('complex-9', 'complex', 'Бизнес-апартаменты', 400000, 50000, 6000),
  asset('complex-10', 'complex', 'Жилой комплекс у стадиона', 400000, 40000, 5000),
];

const TYPE_TITLE: Record<AssetType, string> = {
  studio: 'студию',
  room: 'комнату',
  garage: 'гараж',
  vending: 'автомат',
  fourplex: 'дом на 4 квартиры',
  carwash: 'автомойку',
  cafe: 'кафе',
  complex: 'жилой комплекс',
};

const MULTIPLIERS = [0.9, 1.1, 1.25, 1.4, 1.6];
/**
 * Дом на 4 квартиры и жилой комплекс куплены с ипотекой на 90%: при 160% выручка была бы
 * в 7 раз больше взноса, а у комплекса это 280 000 К за одну карту. Для них потолок — 3 взноса.
 */
const LEVERAGED_MULTIPLIERS = [0.9, 1.0, 1.1, 1.15, 1.2];
const LEVERAGED: AssetType[] = ['fourplex', 'complex'];
const ALL_TYPES = Object.keys(TYPE_TITLE) as AssetType[];

const offers: OfferCard[] = ALL_TYPES.flatMap((assetType, t) =>
  // по 3–4 предложения на тип, разные множители
  (LEVERAGED.includes(assetType) ? LEVERAGED_MULTIPLIERS : MULTIPLIERS).filter((_, i) => (i + t) % 4 !== 3).map((multiplier, i) => ({
    id: `offer-${assetType}-${i + 1}`,
    kind: 'offer' as const,
    assetType,
    title: `Покупатель ищет ${TYPE_TITLE[assetType]}: даёт ${Math.round(multiplier * 100)}% стоимости`,
    multiplier,
  })),
);

const expenses: ExpenseCard[] = [
  { title: 'Прорвало трубу у арендаторов', amount: 1000 },
  { title: 'Жильцы съехали без оплаты', amount: 1500 },
  { title: 'Предписание пожарной инспекции', amount: 500 },
  { title: 'Ремонт крыши', amount: 1500 },
  { title: 'Замена счётчиков', amount: 500 },
  { title: 'Соседи затопили квартиру', amount: 1000 },
  { title: 'Покраска фасада', amount: 1000 },
  { title: 'Новый налог на имущество', amount: 500 },
  { title: 'Замена лифта', amount: 1500 },
  { title: 'Суд с арендатором', amount: 1000 },
  { title: 'Ремонт после арендаторов', amount: 1500 },
  { title: 'Утепление дома', amount: 500 },
].map((e, i) => ({
  id: `expense-${i + 1}`,
  kind: 'expense',
  assetTypes: ['studio', 'room', 'fourplex', 'complex'],
  ...e,
}));

/** Колода «Новости рынка». */
export const market: MarketCard[] = [...offers, ...expenses];

/** Колода «Соблазн»: импульсивные траты. */
export const temptations: TemptationCard[] = [
  ['Кофе навынос каждый день', 100], ['Подписка на третий сериал', 100], ['Билеты в кино', 100], ['Доставка ужина', 100],
  ['Новые кроссовки', 200], ['Концерт любимой группы', 200], ['Подарок на свадьбу', 200], ['Абонемент в спортзал', 200],
  ['Ужин в ресторане', 300], ['Уикенд за городом', 300], ['Новая куртка', 300], ['Игровая приставка', 300],
  ['Новый телефон', 500], ['Ремонт машины', 500], ['Лечение зубов', 500], ['Курсы, которые не пройдёшь', 500],
  ['Отпуск в кредит', 800], ['Новый ноутбук', 800], ['Дизайнерская сумка', 800], ['Свадьба друга за границей', 800],
  ['Новый диван и шкаф', 1200], ['Ремонт кухни', 1200], ['Лодка', 1200], ['Банкет на юбилей', 1200],
  ['Отпуск на островах', 2000], ['Мотоцикл', 2000], ['Ремонт квартиры', 2000], ['Шуба', 2000],
].map(([title, amount], i) => ({ id: `tempt-${i + 1}`, title: title as string, amount: amount as number }));
