import { content } from '../content.js';
import { everydayAmount, roi, trainingSaving, type GameEvent } from '@kapital/engine';
import { art, Icon } from '../art.js';
import {
  ASSET_TITLES, CELL_TITLES, DECK_BACKS, DECK_TITLES, everydayArt, RISK_TITLES, SITUATIONS, dreamTitle, money, percent, signed,
} from '../format.js';
import type { PublicGame, TableApi } from '../net.js';

/** Совпадает с turnSeconds сервера по умолчанию. */
export const TURN_SECONDS = 30;

export function Dice({ roll, rollKey }: { roll: number[]; rollKey: number }) {
  return (
    <div className="dice" aria-label={`Выпало ${roll.join(' и ')}`} role="img">
      {roll.map((d, i) => (
        <span key={`${rollKey}-${i}`} className="dice-roll" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="dice-roll__cycling" />
          <img className="dice-roll__result" src={art(`dice/face-${d}.svg`)} alt="" />
        </span>
      ))}
    </div>
  );
}

/** Круговой таймер хода: анимация CSS сдвигается на уже прошедшее время. */
export function TurnTimer({ deadline, seconds }: { deadline: number; seconds: number }) {
  const elapsed = TURN_SECONDS - seconds;
  return (
    <div className={`timer${seconds <= 5 ? ' warn' : ''}`}>
      <svg key={deadline} className="turn-timer" viewBox="0 0 64 64" aria-hidden="true" style={{ animationDelay: `${25 - elapsed}s` }}>
        <circle className="turn-timer__track" cx="32" cy="32" r="28" pathLength={100} />
        <circle className="turn-timer__progress" cx="32" cy="32" r="28" pathLength={100} style={{ animationDelay: `-${elapsed}s` }} />
      </svg>
      <span className="timer-text">{seconds}</span>
    </div>
  );
}

interface Face {
  deck: string;
  picture: string;
  title: string;
  facts: [string, string][];
  note?: string;
}

function faceOf(game: PublicGame): Face | null {
  const pending = game.pending;
  if (!pending) return null;
  const card = pending.card;
  const deck = DECK_TITLES[pending.deck]!;
  if (pending.deck === 'ventures' && 'income' in card) {
    return { deck, picture: 'deals/venture.webp', title: card.title, facts: [['Доля', money(card.cost)], ['Доход', signed(card.income)]] };
  }
  if (pending.deck === 'everyday') {
    const c = pending.card;
    const player = game.players[game.current]!;
    const amount = everydayAmount(content, player, c);
    const picture = everydayArt(c);
    switch (c.kind) {
      case 'spend':
        return { deck, picture, title: c.title, facts: [['Трата', money(amount)]] };
      case 'trouble': {
        const covered = player.policies.some((x) => x.risk === c.risk);
        return {
          deck, picture, title: c.title, facts: [['Ущерб', money(amount)]],
          note: covered ? `${RISK_TITLES[c.risk]} всё покрыл.` : `От такого защищает ${RISK_TITLES[c.risk].toLowerCase()}.`,
        };
      }
      case 'monthly':
        return {
          deck, picture, title: c.title, facts: [['В период', money(amount)], ['Сколько', `${c.paydays} зарплаты`]],
          note: 'Добавляется к расходам.',
        };
      case 'insurance': {
        const has = player.policies.some((x) => x.risk === c.risk);
        return {
          deck, picture, title: c.title, facts: [['Взнос в период', money(amount)]],
          note: has ? 'Такой полис уже есть.' : `Защищает от неприятностей: ${c.risk === 'health' ? 'здоровье' : 'дом и вещи'}. Отказаться можно в любой свой ход.`,
        };
      }
      case 'training':
        return {
          deck, picture, title: c.title,
          facts: [['Стоимость', money(amount)], ['Расходы', signed(-trainingSaving(content, player, c))]],
          note: 'Прочие расходы снизятся навсегда.',
        };
      case 'windfall':
        return { deck, picture, title: c.title, facts: [['Приход', signed(amount)]] };
    }
  }
  if ('kind' in card) {
    switch (card.kind) {
      case 'asset':
        return {
          deck, picture: `deals/${card.assetType}.webp`, title: card.title,
          facts: [['Цена', money(card.cost)], ['Взнос', money(card.down)], ['Поток', signed(card.flow)], ['Доходность', percent(roi(card.flow, card.down))]],
          note: 'Доходность: поток за период на вложенный взнос.',
        };
      case 'stock':
        return {
          deck, picture: card.price <= 10 ? 'deals/stock-down.webp' : 'deals/stock-up.webp', title: card.title,
          facts: [['Цена акции', money(card.price)], ['Бывает', `${card.low}–${card.high} К`]],
          note: `${card.price <= (card.low + card.high) / 2 ? 'Цена ниже середины диапазона.' : 'Цена выше середины диапазона.'} Продать по ней может любой владелец.`,
        };
      case 'bond':
        return {
          deck, picture: 'invest/bonds.webp', title: card.title,
          facts: [['Номинал', money(card.price)], ['Купон', signed(card.coupon)], ['Доходность', percent(roi(card.coupon, card.price))]],
          note: 'Облигации можно вернуть по номиналу в любой свой ход.',
        };
      case 'offer':
        return {
          deck, picture: 'deals/market-offer.webp', title: card.title,
          facts: [['Цена от покупной', `× ${card.multiplier.toLocaleString('ru-RU')}`]],
          note: `Покупатель на ${ASSET_TITLES[card.assetType].toLowerCase()}: продать может любой владелец.`,
        };
      case 'expense':
        return { deck, picture: 'deals/market-expense.webp', title: card.title, facts: [['Расход', money(card.amount)]] };
    }
  }
  if ('amount' in card) return { deck, picture: 'deals/temptation.webp', title: card.title, facts: [['Трата', money(card.amount)]] };
  return null;
}

function CardFace({ face, tone }: { face: Face; tone: string }) {
  return (
    <article className={`game-card tone-${tone}`}>
      <header>{face.deck}</header>
      <h3>{face.title}</h3>
      <img src={art(face.picture)} alt="" />
      <dl>
        {face.facts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {face.note && <p>{face.note}</p>}
    </article>
  );
}

/** Карта на столе: вылетает из колоды и переворачивается. Её видят все. */
function PendingCard({ game }: { game: PublicGame }) {
  const face = faceOf(game);
  if (!face || !game.pending) return null;
  return (
    <div className="card-deal" key={`${game.pending.deck}-${game.pending.card.id}-${game.current}`}>
      <div className="card-flip">
        <div className="card-flip__inner">
          <img className="card-flip__back card-back" src={art(DECK_BACKS[game.pending.deck]!)} alt="" />
          <div className="card-flip__face"><CardFace face={face} tone={game.pending.deck} /></div>
        </div>
      </div>
    </div>
  );
}

function Situation({ cell, game }: { cell: string; game: PublicGame }) {
  const player = game.players[game.current]!;
  if (cell === 'dream') {
    const ids = content.outerBoard.dreamsAt[player.position] ?? [];
    const id = ids.includes(player.dreamId) ? player.dreamId : ids[0];
    if (!id) return null;
    const mine = id === player.dreamId;
    return (
      <CardFace
        tone="dream"
        face={{
          deck: 'Мечта', picture: `dreams/${id}.webp`, title: dreamTitle(id), facts: [],
          note: mine ? 'Это мечта игрока: купить её значит победить.' : `Здесь продаются: ${ids.map(dreamTitle).join(', ')}.`,
        }}
      />
    );
  }
  const s = SITUATIONS[cell];
  if (!s) return null;
  return <CardFace tone={cell} face={{ deck: CELL_TITLES[cell] ?? cell, picture: s.art, title: CELL_TITLES[cell] ?? cell, facts: [], note: s.text }} />;
}

function DeckChoice({ api, mine }: { api: TableApi; mine: boolean }) {
  const pick = (size: 'small' | 'big') => mine && api.act({ type: 'CHOOSE_DEAL', size });
  return (
    <div className="deck-choice">
      {(['small', 'big'] as const).map((size) => {
        const deck = size === 'small' ? 'smallDeals' : 'bigDeals';
        return (
          <button key={size} className="deck-pile" disabled={!mine} onClick={() => pick(size)}>
            <img src={art(DECK_BACKS[deck]!)} alt="" />
            <span>{DECK_TITLES[deck]}</span>
            <small>{size === 'small' ? 'взнос до 6 000 К' : 'крупные сделки'}</small>
          </button>
        );
      })}
    </div>
  );
}

/** Последняя клетка, куда встал текущий игрок в этом ходу. */
function landedCell(log: GameEvent[], playerId: string): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (e.type === 'turn_started') return null;
    if (e.type === 'landed' && e.playerId === playerId) return e.cell;
  }
  return null;
}

export function Center({ api, game, seconds, deadline }: { api: TableApi; game: PublicGame; seconds: number | null; deadline: number | null }) {
  const current = game.players[game.current]!;
  const mine = current.id === api.me;
  // сквозной номер последнего броска: по нему кубик перезапускает анимацию
  const rollKey = api.logStart + api.log.findLastIndex((e) => e.type === 'rolled');
  const cell = !game.pending ? landedCell(api.log, current.id) : null;

  return (
    <div className="center-stack">
      <div className="center-top">
        <span className="whose">
          <Icon name="ui-user" size={16} />
          {mine ? 'Ваш ход' : `Ходит ${current.name}`}
        </span>
        <span className="turns" title="Ход текущего игрока и лимит партии">
          ход {Math.max(1, current.turnsTaken)} из {content.rules.maxTurns}
        </span>
        {deadline && seconds !== null && game.status === 'playing' && <TurnTimer deadline={deadline} seconds={seconds} />}
      </div>
      {game.lastRoll && <Dice roll={game.lastRoll} rollKey={rollKey} />}
      {game.phase === 'choose_deal' ? (
        <DeckChoice api={api} mine={mine} />
      ) : game.pending ? (
        <PendingCard game={game} />
      ) : cell ? (
        <div className="card-deal" key={`${cell}-${rollKey}`}><Situation cell={cell} game={game} /></div>
      ) : null}
    </div>
  );
}
