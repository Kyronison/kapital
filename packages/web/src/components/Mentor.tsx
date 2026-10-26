import { content } from '../content.js';
import type { PlayerState } from '@kapital/engine';
import { Icon } from '../art.js';
import { percent } from '../format.js';
import type { PublicGame } from '../net.js';
import { updateSettings, useSettings } from '../settings.js';

interface Hint {
  id: string;
  title: string;
  text: string;
}

/** Подсказки к тому, что сейчас происходит у игрока, по важности. Каждая показывается один раз. */
function hintsFor(game: PublicGame, me: PlayerState): Hint[] {
  const mine = game.players[game.current]!.id === me.id;
  const pending = game.pending;
  const rate = percent(content.rules.loanRate);
  const hints: [boolean, Hint][] = [
    [me.circle === 'outer', {
      id: 'outer', title: 'Вы на «Свободном пути»',
      text: 'Зарплаты больше нет, зато доход от капитала вырос в 10 раз. Покупайте доли инвестиций или копите на мечту. Кредитов здесь не дают.',
    }],
    [mine && game.phase === 'roll' && me.turnsTaken === 0, {
      id: 'welcome', title: 'Цель игры',
      text: 'Ниже ваш финансовый отчёт. Нужно, чтобы пассивный доход от активов покрыл все расходы. Тогда вы выйдете из «Круга забот». Бросьте кубик.',
    }],
    [mine && game.phase === 'choose_deal', {
      id: 'choose_deal', title: 'Малая или крупная сделка',
      text: '«Шанс» — недорогие сделки со взносом до 6 000 К. «Проект» — дорогие, но с большим потоком. В начале обычно хватает только на «Шанс».',
    }],
    [mine && pending?.deck !== 'everyday' && !!pending && 'kind' in pending.card && pending.card.kind === 'asset', {
      id: 'deal_asset', title: 'Стоит ли покупать',
      text: `Смотрите на поток и доходность. Если доходность выше ставки кредита (${rate} за период), сделку выгодно купить даже в долг. Отрицательный поток — это пассив, а не актив.`,
    }],
    [!!pending && 'kind' in pending.card && pending.card.kind === 'stock', {
      id: 'stock', title: 'Акции',
      text: 'Под ценой указан её обычный диапазон. Покупайте ниже середины, продавайте выше. Продать по цене на столе может любой владелец, даже не в свой ход.',
    }],
    [!!pending && 'kind' in pending.card && pending.card.kind === 'bond', {
      id: 'bond', title: 'Облигации',
      text: 'Доход у облигаций ниже, чем у бизнеса, зато их можно вернуть по номиналу в любой свой ход. Это запас на чёрный день.',
    }],
    [mine && pending?.deck === 'everyday', {
      id: 'everyday', title: 'Будни',
      text: 'Неприятности бьют по наличным. Полис стоит небольшого взноса каждый период и полностью закрывает свою неприятность. Тренинг навсегда снижает расходы.',
    }],
    [game.phase === 'market' && pending?.deck === 'market', {
      id: 'market', title: 'Покупатель на рынке',
      text: 'Покупатель предлагает долю от цены актива. Вы получите эту сумму минус долг по ипотеке. Продавайте, если выручка покрывает много периодов потока.',
    }],
    [mine && game.phase === 'charity', {
      id: 'charity', title: 'Помощь',
      text: 'Пожертвование стоит 10% дохода. Взамен три хода вы бросаете два кубика и чаще проходите зарплату.',
    }],
    [me.bankLoan > 0, {
      id: 'loan', title: 'Кредит банка',
      text: `За кредит каждый период платится ${rate} суммы, и это входит в расходы. Гасите его, когда появятся свободные деньги, иначе платёж съедает поток.`,
    }],
    [me.children > 0, {
      id: 'baby', title: 'Пополнение',
      text: 'Каждый ребёнок добавляет расходы за период. Больше трёх детей не бывает.',
    }],
  ];
  return hints.filter(([when]) => when).map(([, h]) => h);
}

export function Mentor({ game, me }: { game: PublicGame; me: PlayerState }) {
  const settings = useSettings();
  if (!settings.hints || game.status !== 'playing') return null;
  const hint = hintsFor(game, me).find((h) => !settings.seenHints.includes(h.id));
  if (!hint) return null;
  return (
    <section className="mentor card mentor-in" aria-live="polite">
      <span className="mentor-face" aria-hidden="true"><Icon name="ui-hint" size={22} /></span>
      <div>
        <h2>{hint.title}</h2>
        <p>{hint.text}</p>
        <div className="row">
          <button className="primary" onClick={() => updateSettings((s) => ({ seenHints: [...s.seenHints, hint.id] }))}>Понятно</button>
          <button className="link" onClick={() => updateSettings({ hints: false })}>Больше не подсказывать</button>
        </div>
      </div>
    </section>
  );
}
