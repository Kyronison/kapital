import type { Profession } from './types.js';

export const professions: Profession[] = [
  {
    id: 'courier', title: 'Курьер', salary: 2000,
    expenses: { taxes: 200, housing: 450, car: 80, loans: 50, other: 700 },
    perChild: 110, startCash: 900,
    liabilities: [{ title: 'Кредитные карты', amount: 2000 }],
  },
  {
    id: 'nurse', title: 'Медсестра', salary: 3000,
    expenses: { taxes: 450, housing: 600, car: 0, loans: 190, other: 900 },
    perChild: 160, startCash: 1300,
    liabilities: [
      { title: 'Ипотека', amount: 60000 },
      { title: 'Кредит на обучение', amount: 5000 },
      { title: 'Кредитные карты', amount: 3000 },
    ],
  },
  {
    id: 'teacher', title: 'Учитель', salary: 3300,
    expenses: { taxes: 500, housing: 650, car: 120, loans: 80, other: 1000 },
    perChild: 170, startCash: 1400,
    liabilities: [
      { title: 'Ипотека', amount: 65000 },
      { title: 'Автокредит', amount: 4000 },
      { title: 'Кредитные карты', amount: 3000 },
    ],
  },
  {
    id: 'mechanic', title: 'Автомеханик', salary: 3600,
    expenses: { taxes: 600, housing: 700, car: 200, loans: 100, other: 1000 },
    perChild: 180, startCash: 1500,
    liabilities: [
      { title: 'Ипотека', amount: 70000 },
      { title: 'Автокредит', amount: 7000 },
      { title: 'Кредитные карты', amount: 3500 },
    ],
  },
  {
    id: 'engineer', title: 'Инженер', salary: 5200,
    expenses: { taxes: 1000, housing: 1050, car: 250, loans: 150, other: 1350 },
    perChild: 260, startCash: 2000,
    liabilities: [
      { title: 'Ипотека', amount: 105000 },
      { title: 'Автокредит', amount: 9000 },
      { title: 'Кредитные карты', amount: 5000 },
    ],
  },
  {
    id: 'developer', title: 'Программист', salary: 6500,
    expenses: { taxes: 1300, housing: 1300, car: 300, loans: 200, other: 1700 },
    perChild: 320, startCash: 2500,
    liabilities: [
      { title: 'Ипотека', amount: 130000 },
      { title: 'Автокредит', amount: 11000 },
      { title: 'Кредитные карты', amount: 6000 },
    ],
  },
  {
    id: 'lawyer', title: 'Юрист', salary: 8500,
    expenses: { taxes: 1800, housing: 1600, car: 450, loans: 450, other: 2100 },
    perChild: 420, startCash: 3000,
    liabilities: [
      { title: 'Ипотека', amount: 160000 },
      { title: 'Автокредит', amount: 16000 },
      { title: 'Кредит на обучение', amount: 12000 },
      { title: 'Кредитные карты', amount: 8000 },
    ],
  },
  {
    id: 'surgeon', title: 'Хирург', salary: 12000,
    expenses: { taxes: 2800, housing: 2300, car: 600, loans: 800, other: 2700 },
    perChild: 600, startCash: 4000,
    liabilities: [
      { title: 'Ипотека', amount: 230000 },
      { title: 'Автокредит', amount: 22000 },
      { title: 'Кредит на обучение', amount: 30000 },
      { title: 'Кредитные карты', amount: 12000 },
    ],
  },
];
