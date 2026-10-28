import type { ChoiceOption, Effect, EverydayCard, FollowUp } from './types.js';

/**
 * Колода «Будни»: повседневная жизнь между сделками. Доли считаются от зарплаты.
 * Неприятностей поровну на каждый риск, поэтому полис окупается примерно за год игры.
 */
const basics: EverydayCard[] = [
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

const cash = (share: number): Effect => ({ kind: 'cash', share });
const later = (event: string, paydays: number): Effect => ({ kind: 'later', event, paydays });
const gig = (title: string, share: number, paydays: number): Effect => ({ kind: 'gig', title, share, paydays });
const no = (label = 'Отказаться'): ChoiceOption => ({ label, effects: [] });

/**
 * Дилеммы: решение с последствиями, иногда отложенными. Ожидаемый итог у вариантов близок,
 * разница в риске и сроках: так нет одного «правильного» ответа на все случаи.
 * Карты с professions достаются только этим профессиям.
 */
function dilemmas(): EverydayCard[] {
  const d = (id: string, title: string, text: string, options: ChoiceOption[], professions?: string[]): EverydayCard => ({
    id: `ev-dilemma-${id}`, kind: 'dilemma', title, text, options, ...(professions ? { professions } : {}),
  });
  return [
    d('friend-loan', 'Друг просит в долг', 'Старый друг открывает мастерскую и просит половину зарплаты до лета. Обещает вернуть с процентами.', [
      { label: 'Одолжить', effects: [cash(-0.5), later('fu-friend-loan', 3)] },
      no(),
    ]),
    d('weekend-job', 'Подработка по выходным', 'Знакомые зовут помогать по выходным четыре месяца. Деньги неплохие, но отдыха не будет.', [
      { label: 'Взяться', effects: [gig('Подработка по выходным', 0.15, 4), later('fu-tired', 4)] },
      no('Отдыхать'),
    ]),
    d('car-noise', 'Машина начала стучать', 'В подвеске что-то стучит. Мастер говорит, что можно и подождать, но лучше не тянуть.', [
      { label: 'Починить сейчас', effects: [cash(-0.3)] },
      { label: 'Подождать', effects: [later('fu-car', 2)] },
    ]),
    d('evening-courses', 'Вечерние курсы', 'Курсы повышения квалификации три месяца. После аттестации обещают надбавку.', [
      { label: 'Записаться', effects: [cash(-0.3), later('fu-exam', 3)] },
      no('Не сейчас'),
    ]),
    d('fridge', 'Сломался холодильник', 'Ремонт не поможет. Новый можно взять в рассрочку, а подержанный — сразу и дёшево.', [
      { label: 'Новый в рассрочку', effects: [{ kind: 'monthly', title: 'Рассрочка за холодильник', share: 0.06, paydays: 6 }] },
      { label: 'Подержанный', effects: [cash(-0.25), later('fu-old-fridge', 3)] },
    ]),
    d('pyramid', 'Коллега зовёт в «верную» схему', 'Коллега говорит, что вложил половину зарплаты и через месяц получит вдвое больше. Зовёт присоединиться.', [
      { label: 'Вложиться', effects: [cash(-0.5), later('fu-pyramid', 2)] },
      no(),
    ]),
    d('jubilee', 'Юбилей у родственников', 'Тётя празднует юбилей в другом городе. Ждут всей семьёй.', [
      { label: 'Поехать', effects: [cash(-0.25)] },
      { label: 'Отправить подарок', effects: [cash(-0.1)] },
    ]),
    d('dacha', 'Дача родителей просит ремонта', 'Протекает крыша дачи. Родители просят помочь.', [
      { label: 'Помочь деньгами', effects: [cash(-0.3)] },
      { label: 'Поехать и починить самим', effects: [cash(-0.1), later('fu-harvest', 3)] },
    ]),
    d('lottery', 'Розыгрыш в магазине', 'Магазин продаёт билеты розыгрыша: главный приз — половина зарплаты. Шанс выиграть один к шести.', [
      { label: 'Купить билеты', effects: [cash(-0.1), { kind: 'gamble', odds: 6, win: [cash(0.5)], lose: [] }] },
      no('Пройти мимо'),
    ]),
    d('promotion', 'Повышение с переездом', 'Предлагают должность выше в соседнем городе. Переезд стоит денег, зато надбавка на два года.', [
      { label: 'Согласиться', effects: [cash(-0.4), gig('Надбавка за новую должность', 0.1, 8)] },
      no('Остаться'),
    ]),
    d('courier-nights', 'Ночные смены в праздники', 'Перед праздниками заказов втрое больше. Можно выйти на ночные смены.', [
      { label: 'Выйти', effects: [gig('Ночные смены', 0.2, 3), later('fu-tired', 3)] },
      no('Отдыхать'),
    ], ['courier']),
    d('nurse-home', 'Уколы на дому', 'Соседи просят ставить уколы на дому за плату. Это вечера после смены.', [
      { label: 'Согласиться', effects: [gig('Уколы на дому', 0.12, 5)] },
      no(),
    ], ['nurse']),
    d('teacher-tutor', 'Репетиторство', 'Родители учеников просят позаниматься с детьми. Нужно купить пособия.', [
      { label: 'Взять учеников', effects: [cash(-0.1), gig('Репетиторство', 0.15, 4)] },
      no(),
    ], ['teacher']),
    d('mechanic-box', 'Свой бокс для ремонта', 'Сосед сдаёт гаражный бокс. Можно чинить машины по вечерам, если найдутся клиенты.', [
      { label: 'Арендовать бокс', effects: [cash(-0.5), { kind: 'gamble', odds: 3, win: [gig('Ремонт по вечерам', 0.15, 6)], lose: [] }] },
      no(),
    ], ['mechanic']),
    d('engineer-side', 'Сторонний проект', 'Бывший коллега просит рассчитать проект для его фирмы. Срок жёсткий.', [
      { label: 'Взяться', effects: [gig('Сторонний проект', 0.15, 3), later('fu-tired', 3)] },
      no(),
    ], ['engineer']),
    d('developer-startup', 'Стартап друга', 'Друг делает приложение и зовёт вложиться за долю. Большинство стартапов закрывается, но некоторые выстреливают.', [
      { label: 'Вложиться', effects: [cash(-0.5), later('fu-startup', 4)] },
      no(),
    ], ['developer']),
    d('lawyer-case', 'Дело за процент', 'Клиент предлагает вести дело за процент от выигрыша или за обычный гонорар.', [
      { label: 'За процент', effects: [{ kind: 'gamble', odds: 4, win: [cash(0.8)], lose: [cash(-0.1)] }] },
      { label: 'За гонорар', effects: [cash(0.2)] },
    ], ['lawyer']),
    d('surgeon-clinic', 'Частная клиника', 'Частная клиника зовёт консультировать по субботам. Взамен — меньше отдыха.', [
      { label: 'Согласиться', effects: [gig('Консультации в клинике', 0.1, 6), later('fu-tired', 6)] },
      no(),
    ], ['surgeon']),
    d('barista-cart', 'Своя кофейная тележка', 'У парка продают кофейную тележку. Летом очередь, но место надо ещё отстоять у конкурентов.', [
      { label: 'Купить тележку', effects: [cash(-0.6), { kind: 'gamble', odds: 4, win: [gig('Кофе у парка', 0.2, 6)], lose: [] }] },
      no(),
    ], ['barista']),
    d('musician-wedding', 'Свадьба за городом', 'Зовут сыграть на свадьбе. Платят хорошо, но дорога и аренда аппаратуры за свой счёт, а гости могут и не заплатить сверху.', [
      { label: 'Поехать', effects: [cash(-0.15), { kind: 'gamble', odds: 3, win: [cash(0.45)], lose: [] }] },
      no(),
    ], ['musician']),
    d('musician-album', 'Записать альбом', 'Студия предлагает записать альбом со скидкой. Если песня попадёт в эфир, позовут на гастроли.', [
      { label: 'Записать', effects: [cash(-0.5), later('fu-album', 4)] },
      no('Не сейчас'),
    ], ['musician']),
    d('hairdresser-room', 'Свой кабинет', 'Освободился маленький кабинет рядом с домом. Аренда дороже кресла в салоне, но клиенты будут только ваши, если пойдут за вами.', [
      { label: 'Открыть кабинет', effects: [{ kind: 'monthly', title: 'Аренда кабинета', share: 0.1, paydays: 6 }, { kind: 'gamble', odds: 3, win: [gig('Свои клиенты', 0.2, 6)], lose: [] }] },
      no('Остаться в салоне'),
    ], ['hairdresser']),
    d('trainer-marathon', 'Онлайн-марафон', 'Подписчики просят запустить онлайн-марафон. Нужна реклама, а сколько человек купит — неизвестно.', [
      { label: 'Запустить', effects: [cash(-0.2), { kind: 'gamble', odds: 4, win: [gig('Онлайн-марафон', 0.15, 4)], lose: [] }] },
      no(),
    ], ['trainer']),
    d('taxi-buyout', 'Выкупить машину из лизинга', 'Лизинговая компания предлагает досрочный выкуп машины со скидкой. Платёж за машину станет меньше навсегда, но нужны деньги сейчас.', [
      { label: 'Выкупить', effects: [cash(-1), { kind: 'saving', share: 0.06 }] },
      no('Платить дальше'),
    ], ['taxi']),
    d('cook-banquets', 'Банкеты по выходным', 'Ресторан набирает поваров на выездные банкеты. Деньги хорошие, но выходных не будет.', [
      { label: 'Взяться', effects: [gig('Выездные банкеты', 0.15, 4), later('fu-tired', 4)] },
      no('Отдыхать'),
    ], ['cook']),
    d('scientist-grant', 'Заявка на грант', 'Фонд принимает заявки на грант. Подготовка займёт вечера и деньги на переводы, а выигрывает каждая третья заявка.', [
      { label: 'Подать заявку', effects: [cash(-0.1), later('fu-grant', 4)] },
      no(),
    ], ['scientist']),
    d('firefighter-mortgage', 'Перевести ипотеку на служебную', 'Можно перевести ипотеку на служебную программу. Оценка и бумаги стоят денег, зато платёж станет ниже навсегда.', [
      { label: 'Перевести', effects: [cash(-0.4), { kind: 'saving', share: 0.03 }] },
      no('Оставить как есть'),
    ], ['firefighter']),
    d('electrician-night', 'Ночной вызов', 'Соседний ТЦ остался без света и просит приехать ночью. Двойной тариф, но кабель за свой счёт, и неизвестно, справитесь ли до утра.', [
      { label: 'Поехать', effects: [cash(-0.1), { kind: 'gamble', odds: 3, win: [cash(0.4)], lose: [] }] },
      no('Спать'),
    ], ['electrician']),
    d('farmer-insurance', 'Страховка урожая', 'Синоптики обещают сухое лето. Можно застраховать урожай или рискнуть.', [
      { label: 'Застраховать', effects: [cash(-0.15)] },
      { label: 'Рискнуть', effects: [{ kind: 'gamble', odds: 3, win: [], lose: [cash(-0.5)] }] },
    ], ['farmer']),
    d('farmer-fair', 'Куда продать урожай', 'Перекупщик забирает всё сразу и дёшево. На ярмарке выйдет дороже, если погода не подведёт.', [
      { label: 'Перекупщику', effects: [cash(0.2)] },
      { label: 'На ярмарку', effects: [cash(-0.05), { kind: 'gamble', odds: 3, win: [cash(0.45)], lose: [] }] },
    ], ['farmer']),
    d('accountant-season', 'Сезон отчётов', 'Перед сдачей годовой отчётности знакомые фирмы просят свести баланс. Две зарплаты без выходных.', [
      { label: 'Взяться', effects: [gig('Отчёты для знакомых фирм', 0.2, 2), later('fu-tired', 2)] },
      no('Отдыхать'),
    ], ['accountant']),
    d('designer-prepay', 'Заказ без предоплаты', 'Крупный клиент просит сделать проект без предоплаты и обещает щедро заплатить по итогу. Другой клиент платит скромнее, но сразу.', [
      { label: 'Взять крупный', effects: [later('fu-no-prepay', 3)] },
      { label: 'Взять с предоплатой', effects: [cash(0.3)] },
    ], ['designer']),
    d('trucker-repair', 'Ремонт тягача', 'Тягач требует ремонта. Официальный сервис дорог, а гаражный мастер дешевле, но без гарантии.', [
      { label: 'Официальный сервис', effects: [cash(-0.3)] },
      { label: 'Гаражный мастер', effects: [cash(-0.1), later('fu-truck', 2)] },
    ], ['trucker']),
    d('realtor-urgent', 'Срочная продажа', 'Клиент продаёт квартиру срочно: двойная комиссия, если найдёте покупателя за две недели. Реклама за ваш счёт.', [
      { label: 'Взяться за срочную', effects: [{ kind: 'gamble', odds: 4, win: [cash(0.6)], lose: [cash(-0.1)] }] },
      { label: 'Обычная комиссия', effects: [cash(0.2)] },
    ], ['realtor']),
    d('sales-plan', 'План продаж', 'До конца квартала нужно закрыть план. Можно работать без выходных ради премии — если клиенты не сорвутся.', [
      { label: 'Рвануть', effects: [{ kind: 'gamble', odds: 3, win: [cash(0.5)], lose: [] }, later('fu-tired', 2)] },
      no('Работать спокойно'),
    ], ['sales']),
    d('architect-contest', 'Конкурс проектов', 'Город объявил конкурс на проект парка. Подготовка стоит денег, победитель получает заказ на два года.', [
      { label: 'Участвовать', effects: [cash(-0.3), later('fu-contest', 3)] },
      no(),
    ], ['architect']),
    d('entrepreneur-client', 'Заказчик просит отсрочку', 'Крупный заказчик берёт большую партию, но заплатит только через три месяца. Закупку нужно оплатить сейчас.', [
      { label: 'Согласиться', effects: [cash(-0.3), later('fu-big-client', 3)] },
      no(),
    ], ['entrepreneur']),
    d('entrepreneur-tax', 'Упрощённый налог', 'Бухгалтер советует перейти на упрощённый налог. Переход стоит денег, зато налог станет ниже навсегда.', [
      { label: 'Перейти', effects: [cash(-0.5), { kind: 'saving', share: 0.04 }] },
      no('Оставить как есть'),
    ], ['entrepreneur']),
    d('pilot-medical', 'Медкомиссия', 'Скоро ежегодная медкомиссия. Можно заранее пройти платное обследование и подлечиться. Не пройдёте — месяц без полётов.', [
      { label: 'Обследоваться заранее', effects: [cash(-0.1)] },
      { label: 'Идти как есть', effects: [{ kind: 'gamble', odds: 2, win: [], lose: [{ kind: 'skipSalary', paydays: 1 }] }] },
    ], ['pilot']),
    d('dentist-equipment', 'Новый аппарат', 'Дилер предлагает новый аппарат в рассрочку. С ним можно брать сложных пациентов.', [
      { label: 'Взять в рассрочку', effects: [{ kind: 'monthly', title: 'Рассрочка за аппарат', share: 0.05, paydays: 8 }, gig('Сложные пациенты', 0.07, 8)] },
      no(),
    ], ['dentist']),
    d('executive-options', 'Опционы компании', 'Компания предлагает руководителям выкупить опционы со скидкой. Если компания вырастет, они подорожают втрое.', [
      { label: 'Выкупить', effects: [cash(-0.4), later('fu-options', 4)] },
      no(),
    ], ['executive']),
  ];
}

/** Продолжения историй из дилемм: случаются сами в день зарплаты. */
export const followUps: FollowUp[] = [
  { id: 'fu-friend-loan', title: 'Друг возвращает долг?', effects: [{ kind: 'gamble', odds: 3, win: [cash(0.7)], lose: [] }] },
  { id: 'fu-tired', title: 'Усталость после подработки', effects: [{ kind: 'gamble', odds: 3, win: [], lose: [cash(-0.3)] }] },
  { id: 'fu-car', title: 'Стук в подвеске', effects: [{ kind: 'gamble', odds: 4, win: [], lose: [cash(-0.8)] }] },
  { id: 'fu-exam', title: 'Аттестация после курсов', effects: [{ kind: 'gamble', odds: 3, win: [gig('Надбавка за квалификацию', 0.1, 6)], lose: [] }] },
  { id: 'fu-old-fridge', title: 'Подержанный холодильник', effects: [{ kind: 'gamble', odds: 4, win: [], lose: [cash(-0.2)] }] },
  { id: 'fu-pyramid', title: '«Верная» схема', effects: [{ kind: 'gamble', odds: 6, win: [cash(1)], lose: [] }] },
  { id: 'fu-harvest', title: 'Урожай с родительской дачи', effects: [cash(0.15)] },
  { id: 'fu-startup', title: 'Стартап друга', effects: [{ kind: 'gamble', odds: 5, win: [cash(2)], lose: [] }] },
  { id: 'fu-album', title: 'Песня с альбома в эфире?', effects: [{ kind: 'gamble', odds: 5, win: [gig('Гастроли', 0.3, 4)], lose: [] }] },
  { id: 'fu-grant', title: 'Итоги конкурса грантов', effects: [{ kind: 'gamble', odds: 5, win: [gig('Грант', 0.15, 6)], lose: [] }] },
  { id: 'fu-no-prepay', title: 'Клиент без предоплаты', effects: [{ kind: 'gamble', odds: 3, win: [cash(0.8)], lose: [] }] },
  { id: 'fu-truck', title: 'Ремонт в гараже', effects: [{ kind: 'gamble', odds: 4, win: [], lose: [cash(-0.5)] }] },
  { id: 'fu-contest', title: 'Итоги конкурса проектов', effects: [{ kind: 'gamble', odds: 5, win: [gig('Заказ на парк', 0.15, 8)], lose: [] }] },
  { id: 'fu-big-client', title: 'Заказчик расплачивается', effects: [{ kind: 'gamble', odds: 2, win: [cash(0.6)], lose: [] }] },
  { id: 'fu-options', title: 'Опционы компании', effects: [{ kind: 'gamble', odds: 4, win: [cash(1.2)], lose: [] }] },
];

export const everyday: EverydayCard[] = [...basics, ...dilemmas()];
