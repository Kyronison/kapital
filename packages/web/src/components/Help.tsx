import { levels } from '@kapital/content';
import { art, Icon } from '../art.js';
import { percent } from '../format.js';
import { content } from '../content.js';
import type { TableApi } from '../net.js';
import { updateSettings, useSettings } from '../settings.js';

const STEPS = [
  {
    icon: 'ui-wallet', title: 'Профессия и отчёт',
    text: 'Вы получаете профессию: зарплату, расходы и долги. Всё это видно в финансовом отчёте. Разница между доходами и расходами — ваш денежный поток.',
  },
  {
    icon: 'cell-payday', title: '«Круг забот»',
    text: 'Бросаете кубик и идёте по внутреннему кругу. На клетке зарплаты получаете поток, на остальных — сделки, рынок, траты и события.',
  },
  {
    icon: 'cell-opportunity', title: 'Сделки',
    text: `«Шанс» — недорогие активы, «Проект» — крупные. Покупайте то, что приносит поток. Кредит берётся под ${percent(content.rules.loanRate)} за период.`,
  },
  {
    icon: 'ui-cashflow', title: 'Выход на «Свободный путь»',
    text: 'Когда пассивный доход от активов становится больше всех расходов, вы выходите из «Круга забот» на внешний круг с крупными инвестициями.',
  },
  {
    icon: 'cell-dream', title: 'Мечта',
    text: 'Побеждает тот, кто первым купит свою мечту на «Свободном пути». В «Тренировке» у каждого уровня своя цель и срок.',
  },
];

/** «Помощь»: правила в пяти шагах и настройки обучения. */
export function Help({ api }: { api: TableApi }) {
  const settings = useSettings();
  return (
    <div className="help">
      <section className="card help-intro">
        <img src={art('mentor/explain.webp')} alt="" />
        <div>
          <span className="eyebrow">Как играть</span>
          <h1>Пусть деньги работают на вас</h1>
          <p className="muted">Партия — это путь от зарплаты к пассивному доходу. Правила ниже, а лучше всего они запоминаются в игре: первый уровень «Тренировки» займёт пять минут.</p>
          <button className="primary kap-button" onClick={() => api.startLevel(levels[0]!.id)}><Icon name="ui-level" />Сыграть уровень 1</button>
        </div>
      </section>

      <ol className="help-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card">
            <span className="step-num">{i + 1}</span>
            <Icon name={s.icon} size={32} />
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

      <section className="card learning">
        <h2><Icon name="ui-settings" size={18} />Обучение в партии</h2>
        <label className="toggle">
          <input type="checkbox" checked={settings.hints} onChange={(e) => updateSettings({ hints: e.target.checked, seenHints: e.target.checked ? [] : settings.seenHints })} />
          <span><strong>Подсказки наставника</strong><small className="muted">Короткие объяснения в первый раз, когда что-то происходит. Включение показывает их заново.</small></span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.fillReport} onChange={(e) => updateSettings({ fillReport: e.target.checked })} />
          <span><strong>Заполнять отчёт самому</strong><small className="muted">После сделок раскладывайте строки по доходам, расходам, активам и пассивам.</small></span>
        </label>
      </section>
    </div>
  );
}
