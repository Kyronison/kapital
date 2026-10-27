import { levels } from '@kapital/content';
import { art, Icon } from '../art.js';
import { percent } from '../format.js';
import { content } from '../content.js';
import type { TableApi } from '../net.js';
import { currentLevel } from '../campaign.js';
import { useProgress } from '../campaign-progress.js';

const STEPS = [
  {
    title: 'Профессия и отчёт',
    text: 'Вы получаете профессию: зарплату, расходы и долги. Всё это видно в финансовом отчёте. Разница между доходами и расходами — ваш денежный поток.',
  },
  {
    title: '«Круг забот»',
    text: 'Бросаете кубик и идёте по внутреннему кругу. На клетке зарплаты получаете поток, на остальных — сделки, рынок, траты и события.',
  },
  {
    title: 'Сделки',
    text: `«Шанс» — недорогие активы, «Проект» — крупные. Покупайте то, что приносит поток. Кредит берётся под ${percent(content.rules.loanRate)} за период.`,
  },
  {
    title: 'Выход на «Свободный путь»',
    text: 'Когда пассивный доход от активов становится больше всех расходов, вы выходите из «Круга забот» на внешний круг с крупными инвестициями.',
  },
  {
    title: 'Мечта',
    text: 'Побеждает тот, кто первым купит свою мечту на «Свободном пути». В «Тренировке» у каждого уровня своя цель и срок.',
  },
];

/** «Как играть»: правила в пяти шагах и кнопка в тренировку. */
export function Help({ api }: { api: TableApi }) {
  const progress = useProgress();
  const level = currentLevel(progress);
  const first = levels.indexOf(level) === 0 && !progress[level.id];
  return (
    <div className="help">
      <section className="card help-intro">
        <img src={art('mentor/explain.webp')} alt="" />
        <div>
          <span className="eyebrow">Как играть</span>
          <h1>Пусть деньги работают на вас</h1>
          <p className="muted">Партия — это путь от зарплаты к пассивному доходу. Правила ниже, а лучше всего они запоминаются в игре: первый уровень «Тренировки» займёт пять минут.</p>
          <button className="primary kap-button" onClick={() => api.startLevel(level.id)}>
            <Icon name="ui-level" />
            {first ? 'Начать первую тренировку' : `Продолжить: уровень ${levels.indexOf(level) + 1}`}
          </button>
          <p className="muted help-note">Подсказки наставника и режим финансового отчёта выбираются перед уровнем и в лобби игры.</p>
        </div>
      </section>

      <ol className="help-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card">
            <span className="step-num">{i + 1}</span>
            <img className="help-step-art" src={art(`cabinet/help-steps-${i + 1}.webp`)} alt="" loading="lazy" />
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

    </div>
  );
}
