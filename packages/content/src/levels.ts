import type { Level } from './types.js';

/**
 * «Тренировка»: 15 уровней по 3 в каждой ступени. Сроки подобраны симуляцией
 * (`pnpm sim:levels`): ботом новичок проходится почти всегда, инвестор — примерно в половине партий.
 */
export const levels: Level[] = [
  {
    id: 'novice-1', tier: 'novice', title: 'Первый актив', professionId: 'teacher', dreamId: 'world-trip', mode: 'classic',
    brief: 'Соберите пассивный доход 300 К за период. Ищите на «Шансе» сделки с положительным потоком.',
    goal: { kind: 'passive', amount: 300 }, maxTurns: 15, stars: [6, 10],
  },
  {
    id: 'novice-2', tier: 'novice', title: 'Подушка безопасности', professionId: 'nurse', dreamId: 'sea-house', mode: 'classic',
    brief: 'Накопите 4 000 К наличными. Соблазны и будни мешают — не тратьте лишнего.',
    goal: { kind: 'cash', amount: 4000 }, maxTurns: 18, stars: [6, 10],
  },
  {
    id: 'novice-3', tier: 'novice', title: 'Треть расходов', professionId: 'mechanic', dreamId: 'yacht', mode: 'classic',
    brief: 'Пусть пассивный доход покроет треть расходов. Небольшие сделки складываются в заметный поток.',
    goal: { kind: 'cover', share: 0.33 }, maxTurns: 25, stars: [12, 18],
  },
  {
    id: 'amateur-1', tier: 'amateur', title: 'Свой бизнес с первого дня', professionId: 'teacher', dreamId: 'vineyard', mode: 'quick',
    brief: 'У вас уже есть стартовый бизнес. Выйдите из «Круга забот», пока не кончились ходы.',
    goal: { kind: 'escape' }, maxTurns: 25, stars: [12, 17],
  },
  {
    id: 'amateur-2', tier: 'amateur', title: 'Половина пути', professionId: 'engineer', dreamId: 'foundation', mode: 'classic',
    brief: 'Покройте пассивным доходом половину расходов. Кредит помогает, если сделка доходнее его ставки.',
    goal: { kind: 'cover', share: 0.5 }, maxTurns: 28, stars: [15, 21],
  },
  {
    id: 'amateur-3', tier: 'amateur', title: 'Курьер на старте', professionId: 'courier', dreamId: 'world-trip', mode: 'quick',
    brief: 'Самая скромная зарплата, зато расходы небольшие. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 25, stars: [13, 18],
  },
  {
    id: 'pro-1', tier: 'pro', title: 'Полный путь', professionId: 'teacher', dreamId: 'own-school', mode: 'classic',
    brief: 'Без стартового бизнеса, с нуля. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 40, stars: [24, 32],
  },
  {
    id: 'pro-2', tier: 'pro', title: 'Крупные сделки', professionId: 'developer', dreamId: 'film-studio', mode: 'classic',
    brief: 'Соберите пассивный доход 4 000 К. Без «Проектов» тут не обойтись.',
    goal: { kind: 'passive', amount: 4000 }, maxTurns: 34, stars: [20, 27],
  },
  {
    id: 'pro-3', tier: 'pro', title: 'До мечты', professionId: 'nurse', dreamId: 'world-trip', mode: 'quick',
    brief: 'Выйдите на «Свободный путь» и победите: купите мечту или удвойте доход.',
    goal: { kind: 'win' }, maxTurns: 30, stars: [19, 25],
  },
  {
    id: 'expert-1', tier: 'expert', title: 'Дорогие деньги', professionId: 'mechanic', dreamId: 'yacht', mode: 'classic',
    brief: 'Кредит стоит 9% за период вместо 6%. Выйдите из «Круга забот» и не утоните в долгах.',
    rules: { loanRate: 0.09 }, goal: { kind: 'escape' }, maxTurns: 40, stars: [26, 34],
  },
  {
    id: 'expert-2', tier: 'expert', title: 'Долгое сокращение', professionId: 'engineer', dreamId: 'vineyard', mode: 'quick',
    brief: 'Сокращение лишает трёх зарплат вместо двух. Победите, пока не кончились ходы.',
    rules: { layoffPaydays: 3 }, goal: { kind: 'win' }, maxTurns: 26, stars: [18, 23],
  },
  {
    id: 'expert-3', tier: 'expert', title: 'Высокая планка', professionId: 'lawyer', dreamId: 'foundation', mode: 'classic',
    brief: 'Большая зарплата — большие расходы. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 34, stars: [24, 30],
  },
  {
    id: 'investor-1', tier: 'investor', title: 'Классика целиком', professionId: 'teacher', dreamId: 'sea-house', mode: 'classic',
    brief: 'Полная партия без поблажек: выход из «Круга забот» и победа на «Свободном пути».',
    goal: { kind: 'win' }, maxTurns: 45, stars: [36, 41],
  },
  {
    id: 'investor-2', tier: 'investor', title: 'Снизу вверх', professionId: 'courier', dreamId: 'space-flight', mode: 'classic',
    brief: 'Самая скромная профессия и самая дорогая мечта. Победите в полной партии.',
    goal: { kind: 'win' }, maxTurns: 45, stars: [36, 41],
  },
  {
    id: 'investor-3', tier: 'investor', title: 'Под давлением', professionId: 'surgeon', dreamId: 'film-studio', mode: 'classic',
    brief: 'Кредит 8% за период, а расходы хирурга велики. Победите в полной партии.',
    rules: { loanRate: 0.08 }, goal: { kind: 'win' }, maxTurns: 45, stars: [36, 41],
  },
];
