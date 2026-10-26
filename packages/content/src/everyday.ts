import type { EverydayCard } from './types.js';

/**
 * Колода «Будни»: повседневная жизнь между сделками. Доли считаются от зарплаты.
 * Неприятностей поровну на каждый риск, поэтому полис окупается примерно за год игры.
 */
export const everyday: EverydayCard[] = [
  { id: 'ev-health-1', kind: 'trouble', risk: 'health', title: 'Простуда свалила на неделю', share: 0.3 },
  { id: 'ev-health-2', kind: 'trouble', risk: 'health', title: 'Лечение зуба', share: 0.4 },
  { id: 'ev-health-3', kind: 'trouble', risk: 'health', title: 'Растяжение на тренировке', share: 0.5 },
  { id: 'ev-health-4', kind: 'trouble', risk: 'health', title: 'Обследование у врача', share: 0.6 },
  { id: 'ev-property-1', kind: 'trouble', risk: 'property', title: 'Протечка на кухне', share: 0.3 },
  { id: 'ev-property-2', kind: 'trouble', risk: 'property', title: 'Разбитое окно', share: 0.4 },
  { id: 'ev-property-3', kind: 'trouble', risk: 'property', title: 'Сломалась стиральная машина', share: 0.5 },
  { id: 'ev-property-4', kind: 'trouble', risk: 'property', title: 'Царапина на машине во дворе', share: 0.6 },
  { id: 'ev-spend-1', kind: 'spend', title: 'Разбил телефон', share: 0.1 },
  { id: 'ev-spend-2', kind: 'spend', title: 'Подарок коллеге на юбилей', share: 0.15 },
  { id: 'ev-spend-3', kind: 'spend', title: 'Ремонт машины', share: 0.2 },
  { id: 'ev-monthly-1', kind: 'monthly', title: 'Подписка на кино и музыку', share: 0.03, paydays: 4 },
  { id: 'ev-monthly-2', kind: 'monthly', title: 'Абонемент в бассейн', share: 0.04, paydays: 4 },
  { id: 'ev-monthly-3', kind: 'monthly', title: 'Кружок для ребёнка', share: 0.03, paydays: 6 },
  { id: 'ev-ins-life', kind: 'insurance', risk: 'health', title: 'Полис здоровья', share: 0.03 },
  { id: 'ev-ins-property', kind: 'insurance', risk: 'property', title: 'Полис имущества', share: 0.03 },
  { id: 'ev-training-1', kind: 'training', title: 'Курс по личному бюджету', share: 0.4, saving: 0.03 },
  { id: 'ev-training-2', kind: 'training', title: 'Тренинг по переговорам', share: 0.6, saving: 0.05 },
  { id: 'ev-windfall-1', kind: 'windfall', title: 'Премия за проект', share: 0.5 },
  { id: 'ev-windfall-2', kind: 'windfall', title: 'Налоговый вычет', share: 0.2 },
];
