import type { Dream, VentureCard } from './types.js';

export const dreams: Dream[] = [
  { id: 'sea-house', title: 'Дом у моря', priceInIncomes: 8 },
  { id: 'world-trip', title: 'Кругосветное путешествие', priceInIncomes: 6 },
  { id: 'own-school', title: 'Своя школа', priceInIncomes: 10 },
  { id: 'yacht', title: 'Парусная яхта', priceInIncomes: 8 },
  { id: 'vineyard', title: 'Виноградник', priceInIncomes: 9 },
  { id: 'foundation', title: 'Благотворительный фонд', priceInIncomes: 10 },
  { id: 'space-flight', title: 'Полёт в космос', priceInIncomes: 12 },
  { id: 'film-studio', title: 'Своя киностудия', priceInIncomes: 12 },
];

const v = (id: string, title: string, cost: number, income: number): VentureCard => ({ id, title, cost, income });

/** Крупные инвестиции «Свободного пути»: доли покупают только за наличные. Цена и доход — за одну долю. */
export const ventures: VentureCard[] = [
  v('venture-1', 'Сеть кофеен', 20000, 2400),
  v('venture-2', 'Склад у трассы', 30000, 3000),
  v('venture-3', 'Доля в ИТ-стартапе', 25000, 4000),
  v('venture-4', 'Мини-гостиница', 40000, 4400),
  v('venture-5', 'Фитнес-клуб', 50000, 6000),
  v('venture-6', 'Автосервис', 35000, 4200),
  v('venture-7', 'Солнечная электростанция', 80000, 8800),
  v('venture-8', 'Торговый центр', 150000, 18000),
  v('venture-9', 'Частная клиника', 120000, 15600),
  v('venture-10', 'Логистическая компания', 100000, 11000),
  v('venture-11', 'Бизнес-центр', 200000, 26000),
  v('venture-12', 'Сеть пекарен', 45000, 5400),
  v('venture-13', 'Коворкинг', 30000, 3600),
  v('venture-14', 'Гостиничный комплекс', 250000, 30000),
  v('venture-15', 'Агрохолдинг', 180000, 19800),
  v('venture-16', 'Производство мебели', 60000, 7800),
  v('venture-17', 'Онлайн-школа', 25000, 3500),
  v('venture-18', 'Парк аттракционов', 300000, 33000),
  v('venture-19', 'Сеть автомоек', 70000, 8400),
  v('venture-20', 'Завод упаковки', 220000, 24200),
  v('venture-21', 'Франшиза ресторанов', 90000, 9900),
  v('venture-22', 'Дата-центр', 400000, 52000),
  v('venture-23', 'Горнолыжный курорт', 350000, 38500),
  v('venture-24', 'Порт для яхт', 160000, 16000),
];
