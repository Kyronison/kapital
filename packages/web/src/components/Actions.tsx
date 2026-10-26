import { defaultContent as content } from '@kapital/content';
import { availableLoan, dreamPrice, passiveIncome, professionOf, type PlayerState } from '@kapital/engine';
import { useState } from 'react';
import { ASSET_TITLES, money, signed } from '../format.js';
import type { PublicGame, TableApi } from '../net.js';

/** Карта на столе: её видят все, даже не в свой ход. */
export function PendingCard({ game }: { game: PublicGame }) {
  const pending = game.pending;
  if (!pending) return game.lastRoll ? <div className="dice">{game.lastRoll.map((d, i) => <span key={i}>{d}</span>)}</div> : null;
  const card = pending.card;
  let body: string;
  if (pending.deck === 'ventures' && 'income' in card) body = `Доля: ${money(card.cost)}, доход ${signed(card.income)} за период`;
  else if ('kind' in card && card.kind === 'asset') body = `Цена ${money(card.cost)}, взнос ${money(card.down)}, поток ${signed(card.flow)}`;
  else if ('kind' in card && card.kind === 'stock') body = `Цена акции ${money(card.price)}. Продать по этой цене может любой владелец.`;
  else if ('kind' in card && card.kind === 'offer') body = `Покупатель на ${ASSET_TITLES[card.assetType].toLowerCase()}: любой владелец может продать.`;
  else if ('amount' in card) body = `Трата ${money(card.amount)}`;
  else body = '';
  return (
    <div className="pending">
      <div className="deck">{DECK_TITLES[pending.deck]}</div>
      <strong>{card.title}</strong>
      <p>{body}</p>
    </div>
  );
}

const DECK_TITLES: Record<string, string> = {
  smallDeals: 'Шанс',
  bigDeals: 'Проект',
  market: 'Новости рынка',
  temptations: 'Соблазн',
  ventures: 'Инвестиция',
};

export function Actions({ api, game, me }: { api: TableApi; game: PublicGame; me: PlayerState }) {
  const myTurn = game.players[game.current]!.id === me.id;
  const [shares, setShares] = useState(10);
  const pending = game.pending;
  const step = content.rules.loanStep;
  const end = <button onClick={() => api.act({ type: 'END_TURN' })}>Завершить ход</button>;

  // продажи доступны всем владельцам, в том числе не в свой ход
  const sales: JSX.Element[] = [];
  if (game.phase === 'deal' && pending?.deck === 'smallDeals' && pending.card.kind === 'stock') {
    const card = pending.card;
    const h = me.stocks.find((s) => s.ticker === card.ticker);
    if (h) sales.push(
      <button key="sell-stock" onClick={() => api.act({ type: 'SELL_STOCK', shares: h.shares })}>
        Продать {h.shares} акций за {money(h.shares * card.price)}
      </button>,
    );
  }
  if (game.phase === 'market' && pending?.deck === 'market' && pending.card.kind === 'offer') {
    const offer = pending.card;
    for (const a of me.assets.filter((x) => x.assetType === offer.assetType)) {
      sales.push(
        <button key={a.id} onClick={() => api.act({ type: 'SELL_ASSET', assetId: a.id })}>
          Продать «{a.title}»: {signed(Math.round(a.cost * offer.multiplier) - a.mortgage)}
        </button>,
      );
    }
  }

  let main: JSX.Element | null = null;
  if (myTurn) {
    switch (game.phase) {
      case 'roll':
        main = (
          <button className="primary" onClick={() => api.act({ type: 'ROLL' })}>
            {me.charityTurns > 0 ? 'Бросить два кубика' : 'Бросить кубик'}
          </button>
        );
        break;
      case 'choose_deal':
        main = (
          <>
            <button className="primary" onClick={() => api.act({ type: 'CHOOSE_DEAL', size: 'small' })}>Шанс: малая сделка</button>
            <button onClick={() => api.act({ type: 'CHOOSE_DEAL', size: 'big' })}>Проект: крупная сделка</button>
            {end}
          </>
        );
        break;
      case 'deal': {
        const card = pending?.card;
        if (pending?.deck === 'ventures' && card && 'income' in card) {
          const max = Math.floor(me.cash / card.cost);
          main = (
            <>
              <input type="number" min={1} max={Math.max(1, max)} value={shares} onChange={(e) => setShares(Number(e.target.value))} aria-label="Сколько долей" />
              <button className="primary" disabled={shares < 1 || shares > max} onClick={() => api.act({ type: 'BUY', shares })}>
                Купить долей: {shares} за {money(shares * card.cost)}
              </button>
              {end}
            </>
          );
        } else if (card && 'kind' in card && card.kind === 'asset') {
          const short = card.down - me.cash;
          main = (
            <>
              <button className="primary" disabled={short > 0} onClick={() => api.act({ type: 'BUY' })}>
                Купить за {money(card.down)}
              </button>
              {short > 0 && <span className="muted">Не хватает {money(short)}: возьмите кредит ниже</span>}
              {end}
            </>
          );
        } else if (card && 'kind' in card && card.kind === 'stock') {
          main = (
            <>
              {!game.pendingResolved && (
                <>
                  <input type="number" min={1} value={shares} onChange={(e) => setShares(Number(e.target.value))} aria-label="Сколько акций" />
                  <button className="primary" disabled={shares * card.price > me.cash || shares < 1} onClick={() => api.act({ type: 'BUY', shares })}>
                    Купить {shares} шт. за {money(shares * card.price)}
                  </button>
                </>
              )}
              {end}
            </>
          );
        } else main = end;
        break;
      }
      case 'charity': {
        const income = me.circle === 'inner' ? professionOf(content, me).salary + passiveIncome(me) : me.outerIncome;
        const amount = Math.round(content.rules.charityShare * income);
        main = (
          <>
            <button className="primary" disabled={me.cash < amount} onClick={() => api.act({ type: 'DONATE' })}>
              Пожертвовать {money(amount)} и бросать два кубика 3 хода
            </button>
            {end}
          </>
        );
        break;
      }
      case 'dream': {
        const price = dreamPrice(content, me);
        main = (
          <>
            <button className="primary" disabled={me.cash < price} onClick={() => api.act({ type: 'BUY_DREAM' })}>
              Купить мечту за {money(price)}
            </button>
            {end}
          </>
        );
        break;
      }
      default:
        main = end;
    }
  }

  const loan = myTurn && game.phase !== 'roll' && (
    <div className="loan">
      {me.circle === 'inner' && (
        <button disabled={availableLoan(content, me) < step} onClick={() => api.act({ type: 'TAKE_LOAN', amount: step })}>
          Кредит +{money(step)}
        </button>
      )}
      <button disabled={me.bankLoan < step || me.cash < step} onClick={() => api.act({ type: 'REPAY_LOAN', amount: step })}>
        Погасить {money(step)}
      </button>
    </div>
  );

  return (
    <section className="actions card">
      <h2>{myTurn ? 'Ваш ход' : `Ходит ${game.players[game.current]!.name}`}</h2>
      <div className="row wrap">{main}{sales}</div>
      {loan}
    </section>
  );
}
