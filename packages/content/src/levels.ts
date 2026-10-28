import type { Level } from './types.js';

/**
 * «Тренировка»: две части по 30 уровней, в каждой по 6 на ступень. Сроки подобраны симуляцией
 * (`pnpm sim:levels`): ботом новичок проходится почти всегда, инвестор — примерно в половине партий.
 * Вторая часть — на новых профессиях и о том, как распознать невыгодную сделку.
 */
const part1: Level[] = [
  {
    id: 'novice-1', tier: 'novice', title: 'Первый актив', professionId: 'teacher', dreamId: 'world-trip', mode: 'classic',
    brief: 'Соберите пассивный доход 300 К за период. Ищите на «Шансе» сделки с положительным потоком.',
    goal: { kind: 'passive', amount: 300 }, maxTurns: 15, stars: [6, 10],
  },
  {
    id: 'novice-2', tier: 'novice', title: 'Подушка безопасности', professionId: 'nurse', dreamId: 'sea-house', mode: 'classic',
    brief: 'Накопите 2 500 К своих денег: долг банку вычитается. Соблазны и будни мешают — не тратьте лишнего.',
    goal: { kind: 'cash', amount: 2500 }, maxTurns: 18, stars: [6, 10],
  },
  {
    id: 'novice-3', tier: 'novice', title: 'Треть расходов', professionId: 'mechanic', dreamId: 'yacht', mode: 'classic',
    brief: 'Пусть пассивный доход покроет треть расходов. Небольшие сделки складываются в заметный поток.',
    goal: { kind: 'cover', share: 0.33 }, maxTurns: 25, stars: [12, 18],
  },
  {
    id: 'novice-4', tier: 'novice', title: 'Без лишних трат', professionId: 'engineer', dreamId: 'sea-house', mode: 'classic',
    brief: 'Накопите 4 000 К своих денег: долг банку вычитается. Зарплата приличная, но соблазны рядом.',
    goal: { kind: 'cash', amount: 4000 }, maxTurns: 20, stars: [8, 12],
  },
  {
    id: 'novice-5', tier: 'novice', title: 'Поток растёт', professionId: 'courier', dreamId: 'world-trip', mode: 'classic',
    brief: 'Соберите пассивный доход 600 К за период. На скромную зарплату каждая сделка на счету.',
    goal: { kind: 'passive', amount: 600 }, maxTurns: 25, stars: [7, 12],
  },
  {
    id: 'novice-6', tier: 'novice', title: 'Половина со стартом', professionId: 'developer', dreamId: 'film-studio', mode: 'quick',
    brief: 'Со стартовым бизнесом покройте пассивным доходом половину расходов.',
    goal: { kind: 'cover', share: 0.5 }, maxTurns: 15, stars: [6, 10],
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
    id: 'amateur-4', tier: 'amateur', title: 'Юрист со стартом', professionId: 'lawyer', dreamId: 'yacht', mode: 'quick',
    brief: 'Высокая зарплата и высокие расходы. Стартовый бизнес уже есть — выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 17, stars: [10, 14],
  },
  {
    id: 'amateur-5', tier: 'amateur', title: 'Полторы тысячи', professionId: 'mechanic', dreamId: 'vineyard', mode: 'classic',
    brief: 'Соберите пассивный доход 1 500 К за период. Присматривайтесь к «Проектам».',
    goal: { kind: 'passive', amount: 1500 }, maxTurns: 30, stars: [16, 23],
  },
  {
    id: 'amateur-6', tier: 'amateur', title: 'Почти свобода', professionId: 'nurse', dreamId: 'own-school', mode: 'classic',
    brief: 'Покройте пассивным доходом 70% расходов. Страховка спасёт наличные от неприятностей.',
    goal: { kind: 'cover', share: 0.7 }, maxTurns: 32, stars: [18, 25],
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
    brief: 'Выйдите на «Свободный путь» и победите: накопите на мечту и купите её.',
    goal: { kind: 'win' }, maxTurns: 30, stars: [19, 25],
  },
  {
    id: 'pro-4', tier: 'pro', title: 'Курьер до мечты', professionId: 'courier', dreamId: 'sea-house', mode: 'quick',
    brief: 'Скромная зарплата, стартовый бизнес и большая цель: победите на «Свободном пути».',
    goal: { kind: 'win' }, maxTurns: 30, stars: [19, 25],
  },
  {
    id: 'pro-5', tier: 'pro', title: 'Хирург с нуля', professionId: 'surgeon', dreamId: 'yacht', mode: 'classic',
    brief: 'Самая большая зарплата и самые большие расходы. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 40, stars: [24, 32],
  },
  {
    id: 'pro-6', tier: 'pro', title: 'Шесть тысяч потока', professionId: 'developer', dreamId: 'space-flight', mode: 'classic',
    brief: 'Соберите пассивный доход 6 000 К за период. Без крупных сделок не обойтись.',
    goal: { kind: 'passive', amount: 6000 }, maxTurns: 40, stars: [24, 32],
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
    id: 'expert-4', tier: 'expert', title: 'Банк скупится', professionId: 'teacher', dreamId: 'world-trip', mode: 'classic',
    brief: 'Кредит стоит 9% за период, а зарплата учителя скромная. Выйдите из «Круга забот».',
    rules: { loanRate: 0.09 }, goal: { kind: 'escape' }, maxTurns: 40, stars: [26, 34],
  },
  {
    id: 'expert-5', tier: 'expert', title: 'Быстро и дорого', professionId: 'lawyer', dreamId: 'film-studio', mode: 'quick',
    brief: 'Кредит 9% за период. Победите на «Свободном пути», пока не кончились ходы.',
    rules: { loanRate: 0.09 }, goal: { kind: 'win' }, maxTurns: 28, stars: [19, 24],
  },
  {
    id: 'expert-6', tier: 'expert', title: 'Двойной удар', professionId: 'nurse', dreamId: 'vineyard', mode: 'classic',
    brief: 'Сокращение лишает трёх зарплат, кредит стоит 8%. Выйдите из «Круга забот».',
    rules: { loanRate: 0.08, layoffPaydays: 3 }, goal: { kind: 'escape' }, maxTurns: 40, stars: [26, 34],
  },
  {
    id: 'investor-1', tier: 'investor', title: 'Классика целиком', professionId: 'teacher', dreamId: 'sea-house', mode: 'classic',
    brief: 'Полная партия без поблажек: выход из «Круга забот» и победа на «Свободном пути».',
    goal: { kind: 'win' }, maxTurns: 47, stars: [38, 43],
  },
  {
    id: 'investor-2', tier: 'investor', title: 'Снизу вверх', professionId: 'courier', dreamId: 'space-flight', mode: 'classic',
    brief: 'Самая скромная профессия и самая дорогая мечта. Победите в полной партии.',
    goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-3', tier: 'investor', title: 'Под давлением', professionId: 'surgeon', dreamId: 'film-studio', mode: 'classic',
    brief: 'Кредит 8% за период, а расходы хирурга велики. Победите в полной партии.',
    rules: { loanRate: 0.08 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-4', tier: 'investor', title: 'Дорогой капитал', professionId: 'developer', dreamId: 'yacht', mode: 'classic',
    brief: 'Кредит 9% за период. Пройдите партию целиком и победите.',
    rules: { loanRate: 0.09 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-5', tier: 'investor', title: 'Без страховки от судьбы', professionId: 'engineer', dreamId: 'own-school', mode: 'classic',
    brief: 'Сокращение лишает трёх зарплат. Победите в полной партии.',
    rules: { layoffPaydays: 3 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-6', tier: 'investor', title: 'Финал', professionId: 'lawyer', dreamId: 'space-flight', mode: 'classic',
    brief: 'Всё сразу: кредит 8%, долгое сокращение и самая дорогая мечта. Докажите, что вы инвестор.',
    rules: { loanRate: 0.08, layoffPaydays: 3 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
];

const part2: Level[] = [
  {
    id: 'novice-7', tier: 'novice', title: 'Не всё, что блестит', professionId: 'barista', dreamId: 'world-trip', mode: 'classic',
    brief: 'В колодах есть ловушки: переплата, минусовой поток, скрытый риск. Соберите пассивный доход 300 К и не берите то, что не окупает кредит.',
    goal: { kind: 'passive', amount: 300 }, maxTurns: 15, stars: [6, 10],
  },
  {
    id: 'novice-8', tier: 'novice', title: 'Гонорар в копилку', professionId: 'musician', dreamId: 'sea-house', mode: 'classic',
    brief: 'Накопите 2 000 К своих денег: долг банку вычитается. Концерты платят нерегулярно — не тратьте на соблазны.',
    goal: { kind: 'cash', amount: 2000 }, maxTurns: 18, stars: [6, 10],
  },
  {
    id: 'novice-9', tier: 'novice', title: 'Своё кресло', professionId: 'hairdresser', dreamId: 'vineyard', mode: 'classic',
    brief: 'Пусть пассивный доход покроет треть расходов. Смотрите не только на поток: у дешёвых объектов бывает подвох.',
    goal: { kind: 'cover', share: 0.33 }, maxTurns: 25, stars: [12, 18],
  },
  {
    id: 'novice-10', tier: 'novice', title: 'Лизинг давит', professionId: 'taxi', dreamId: 'yacht', mode: 'classic',
    brief: 'Машина съедает почти четверть дохода. Соберите пассивный доход 500 К за период.',
    goal: { kind: 'passive', amount: 500 }, maxTurns: 25, stars: [8, 13],
  },
  {
    id: 'novice-11', tier: 'novice', title: 'Кухня и цифры', professionId: 'cook', dreamId: 'world-trip', mode: 'classic',
    brief: 'Накопите 2 500 К своих денег. Банкеты по выходным помогут, если хватит сил.',
    goal: { kind: 'cash', amount: 2500 }, maxTurns: 20, stars: [7, 11],
  },
  {
    id: 'novice-12', tier: 'novice', title: 'Грант на старт', professionId: 'scientist', dreamId: 'own-school', mode: 'quick',
    brief: 'Со стартовым бизнесом покройте пассивным доходом половину расходов.',
    goal: { kind: 'cover', share: 0.5 }, maxTurns: 15, stars: [6, 10],
  },
  {
    id: 'amateur-7', tier: 'amateur', title: 'Пожарный запас', professionId: 'firefighter', dreamId: 'sea-house', mode: 'quick',
    brief: 'Служебная ипотека и стартовый бизнес. Выйдите из «Круга забот», пока не кончились ходы.',
    goal: { kind: 'escape' }, maxTurns: 25, stars: [12, 17],
  },
  {
    id: 'amateur-8', tier: 'amateur', title: 'Свет в конце', professionId: 'electrician', dreamId: 'vineyard', mode: 'classic',
    brief: 'Покройте пассивным доходом половину расходов. Стройка дешевле рынка, но доход у неё появится не сразу.',
    goal: { kind: 'cover', share: 0.5 }, maxTurns: 28, stars: [15, 21],
  },
  {
    id: 'amateur-9', tier: 'amateur', title: 'Амбар и трактор', professionId: 'farmer', dreamId: 'foundation', mode: 'classic',
    brief: 'Амбар уже приносит доход. Соберите пассивный доход 1 500 К за период.',
    goal: { kind: 'passive', amount: 1500 }, maxTurns: 30, stars: [16, 23],
  },
  {
    id: 'amateur-10', tier: 'amateur', title: 'Сводим баланс', professionId: 'accountant', dreamId: 'film-studio', mode: 'quick',
    brief: 'Ровная зарплата и стартовый бизнес. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 20, stars: [11, 15],
  },
  {
    id: 'amateur-11', tier: 'amateur', title: 'Без предоплаты', professionId: 'designer', dreamId: 'world-trip', mode: 'classic',
    brief: 'Покройте пассивным доходом 70% расходов. Налог маленький, зато подписки и техника дорогие.',
    goal: { kind: 'cover', share: 0.7 }, maxTurns: 32, stars: [18, 25],
  },
  {
    id: 'amateur-12', tier: 'amateur', title: 'Тренер со стартом', professionId: 'trainer', dreamId: 'sea-house', mode: 'quick',
    brief: 'Скромная зарплата и стартовый бизнес. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 25, stars: [13, 18],
  },
  {
    id: 'pro-7', tier: 'pro', title: 'Дальняя дорога', professionId: 'trucker', dreamId: 'yacht', mode: 'classic',
    brief: 'Тягач в кредите, без стартового бизнеса. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 40, stars: [24, 32],
  },
  {
    id: 'pro-8', tier: 'pro', title: 'Свой рынок', professionId: 'realtor', dreamId: 'vineyard', mode: 'classic',
    brief: 'Комната уже сдаётся. Соберите пассивный доход 4 000 К: переплаченные объекты не помогут.',
    goal: { kind: 'passive', amount: 4000 }, maxTurns: 34, stars: [20, 27],
  },
  {
    id: 'pro-9', tier: 'pro', title: 'План продаж', professionId: 'sales', dreamId: 'film-studio', mode: 'quick',
    brief: 'Выйдите на «Свободный путь» и победите: накопите на мечту и купите её.',
    goal: { kind: 'win' }, maxTurns: 30, stars: [19, 25],
  },
  {
    id: 'pro-10', tier: 'pro', title: 'Конкурс проектов', professionId: 'architect', dreamId: 'space-flight', mode: 'classic',
    brief: 'Соберите пассивный доход 6 000 К за период. Объекты с торгов дешевле рынка, но сначала забирают деньги.',
    goal: { kind: 'passive', amount: 6000 }, maxTurns: 40, stars: [24, 32],
  },
  {
    id: 'pro-11', tier: 'pro', title: 'Своё дело', professionId: 'entrepreneur', dreamId: 'foundation', mode: 'classic',
    brief: 'Кофейный автомат уже работает, а кредит на развитие тянет расходы. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 40, stars: [24, 32],
  },
  {
    id: 'pro-12', tier: 'pro', title: 'Бариста до мечты', professionId: 'barista', dreamId: 'sea-house', mode: 'quick',
    brief: 'Самая скромная зарплата и большая цель: победите на «Свободном пути».',
    goal: { kind: 'win' }, maxTurns: 30, stars: [19, 25],
  },
  {
    id: 'expert-7', tier: 'expert', title: 'Лётная школа', professionId: 'pilot', dreamId: 'yacht', mode: 'classic',
    brief: 'Кредит стоит 9% за период: в долг окупаются только лучшие сделки. Выйдите из «Круга забот».',
    rules: { loanRate: 0.09 }, goal: { kind: 'escape' }, maxTurns: 40, stars: [26, 34],
  },
  {
    id: 'expert-8', tier: 'expert', title: 'Кабинет в кредит', professionId: 'dentist', dreamId: 'own-school', mode: 'quick',
    brief: 'Кредит 9% за период. Победите на «Свободном пути», пока не кончились ходы.',
    rules: { loanRate: 0.09 }, goal: { kind: 'win' }, maxTurns: 28, stars: [19, 24],
  },
  {
    id: 'expert-9', tier: 'expert', title: 'Дорогие привычки', professionId: 'executive', dreamId: 'film-studio', mode: 'classic',
    brief: 'Самая высокая зарплата и самые большие расходы. Выйдите из «Круга забот».',
    goal: { kind: 'escape' }, maxTurns: 34, stars: [24, 30],
  },
  {
    id: 'expert-10', tier: 'expert', title: 'Засуха', professionId: 'farmer', dreamId: 'vineyard', mode: 'classic',
    brief: 'Сокращение лишает трёх зарплат вместо двух. Выйдите из «Круга забот».',
    rules: { layoffPaydays: 3 }, goal: { kind: 'escape' }, maxTurns: 40, stars: [26, 34],
  },
  {
    id: 'expert-11', tier: 'expert', title: 'Таксист на скорости', professionId: 'taxi', dreamId: 'world-trip', mode: 'quick',
    brief: 'Кредит 9% за период. Победите на «Свободном пути».',
    rules: { loanRate: 0.09 }, goal: { kind: 'win' }, maxTurns: 30, stars: [20, 25],
  },
  {
    id: 'expert-12', tier: 'expert', title: 'Двойная смена', professionId: 'cook', dreamId: 'foundation', mode: 'classic',
    brief: 'Сокращение лишает трёх зарплат, кредит стоит 8%. Выйдите из «Круга забот».',
    rules: { loanRate: 0.08, layoffPaydays: 3 }, goal: { kind: 'escape' }, maxTurns: 40, stars: [26, 34],
  },
  {
    id: 'investor-7', tier: 'investor', title: 'Высокий полёт', professionId: 'pilot', dreamId: 'space-flight', mode: 'classic',
    brief: 'Кредит 8% за период. Победите в полной партии.',
    rules: { loanRate: 0.08 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-8', tier: 'investor', title: 'Музыкант-инвестор', professionId: 'musician', dreamId: 'yacht', mode: 'classic',
    brief: 'Скромная и нерегулярная зарплата. Победите в полной партии.',
    goal: { kind: 'win' }, maxTurns: 46, stars: [37, 42],
  },
  {
    id: 'investor-9', tier: 'investor', title: 'Без поблажек', professionId: 'executive', dreamId: 'space-flight', mode: 'classic',
    brief: 'Кредит 9% за период и огромные расходы. Победите в полной партии.',
    rules: { loanRate: 0.09 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-10', tier: 'investor', title: 'Под нагрузкой', professionId: 'dentist', dreamId: 'sea-house', mode: 'classic',
    brief: 'Сокращение лишает трёх зарплат. Победите в полной партии.',
    rules: { layoffPaydays: 3 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-11', tier: 'investor', title: 'Своё дело целиком', professionId: 'entrepreneur', dreamId: 'own-school', mode: 'classic',
    brief: 'Кредит 8% и долгое сокращение. Победите в полной партии.',
    rules: { loanRate: 0.08, layoffPaydays: 3 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
  {
    id: 'investor-12', tier: 'investor', title: 'Большой финал', professionId: 'trucker', dreamId: 'space-flight', mode: 'classic',
    brief: 'Всё сразу: кредит 9%, долгое сокращение и самая дорогая мечта. Докажите, что вы инвестор.',
    rules: { loanRate: 0.09, layoffPaydays: 3 }, goal: { kind: 'win' }, maxTurns: 50, stars: [40, 45],
  },
];

/** Части «Тренировки»: у каждой своя карта, первая клетка части открыта сразу. */
export const chapters: { title: string; levels: Level[] }[] = [
  { title: 'Часть 1. Основы', levels: part1 },
  { title: 'Часть 2. Подвохи и профессии', levels: part2 },
];

export const levels: Level[] = chapters.flatMap((c) => c.levels);
