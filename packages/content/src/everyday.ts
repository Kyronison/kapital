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
];

export const everyday: EverydayCard[] = [...basics, ...dilemmas()];
