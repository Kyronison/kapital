import { content } from '../content.js';
import {
  availableLoan, dreamPrice, everydayAmount, passiveIncome, professionOf, trainingSaving, type PlayerState,
} from '@kapital/engine';
import { useEffect, useState } from 'react';
import { Icon } from '../art.js';
import { money, RISK_TITLES, signed } from '../format.js';
import type { PublicGame, Reaction, TableApi } from '../net.js';
import { Outcome, outcomeOf } from './Outcome.js';

function useSecondsLeft(until: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
}

export function Actions({ api, game, me, reaction, seconds }: {
  api: TableApi; game: PublicGame; me: PlayerState; reaction: Reaction | null; seconds: number | null;
}) {
  const myTurn = game.players[game.current]!.id === me.id;
  const secondsLeft = useSecondsLeft(reaction?.until ?? null);
  const awaitingMe = reaction?.waiting.includes(me.id) ?? false;
  const awaited = (reaction?.waiting ?? []).map((id) => game.players.find((p) => p.id === id)?.name ?? id);
  const [shares, setShares] = useState(10);
  // на телефоне кредит, вклад и полисы свёрнуты, чтобы панель хода не закрывала поле
  const [moreOpen, setMoreOpen] = useState(false);
  const pending = game.pending;
  const step = content.rules.loanStep;
  const depositStep = content.rules.depositStep;
  const end = <button className="ghost" onClick={() => api.act({ type: 'END_TURN' })}>Завершить ход</button>;

  // продажи доступны всем владельцам, в том числе не в свой ход
  const sales: JSX.Element[] = [];
  if (game.phase === 'deal' && pending?.deck === 'smallDeals' && pending.card.kind === 'stock') {
    const card = pending.card;
    const h = me.stocks.find((s) => s.ticker === card.ticker);
    if (h) sales.push(
      <button key="sell-stock" className="sell" onClick={() => api.act({ type: 'SELL_STOCK', shares: h.shares })}>
        <Icon name="ui-sell" />
        Продать {h.shares} акций за {money(h.shares * card.price)}
      </button>,
    );
  }
  if (game.phase === 'market' && pending?.deck === 'market' && pending.card.kind === 'offer') {
    const offer = pending.card;
    for (const a of me.assets.filter((x) => x.assetType === offer.assetType)) {
      sales.push(
        <button key={a.id} className="sell" onClick={() => api.act({ type: 'SELL_ASSET', assetId: a.id })}>
          <Icon name="ui-sell" />
          Продать «{a.title}»: {signed(Math.round(a.cost * offer.multiplier) - a.mortgage)}
        </button>,
      );
    }
  }

  if (awaitingMe) {
    sales.push(
      <button key="pass" className="ghost" onClick={() => api.send('pass')}>
        Не продавать{secondsLeft !== null ? ` · ${secondsLeft} с` : ''}
      </button>,
    );
  }

  let main: JSX.Element | null = null;
  if (myTurn && reaction) {
    main = <p className="muted">Ход завершён. Ждём, продадут ли соперники по этой цене: {awaited.join(', ')}{secondsLeft !== null ? `, ещё ${secondsLeft} с` : ''}.</p>;
  } else if (myTurn) {
    switch (game.phase) {
      case 'roll':
        main = (
          <button className="primary big" onClick={() => api.act({ type: 'ROLL' })}>
            <Icon name="ui-dice" />
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
        if (pending?.deck === 'everyday') {
          const c = pending.card;
          const amount = everydayAmount(content, me, c);
          main = (
            <>
              {c.kind === 'insurance' && (
                <button className="primary" onClick={() => api.act({ type: 'BUY' })}>
                  <Icon name={`ui-insurance-${c.risk === 'health' ? 'life' : 'property'}`} />
                  Оформить за {money(amount)} в период
                </button>
              )}
              {c.kind === 'training' && (
                <button className="primary" disabled={me.cash < amount} onClick={() => api.act({ type: 'BUY' })}>
                  <Icon name="ui-training" />
                  Пройти за {money(amount)}, расходы {signed(-trainingSaving(content, me, c))}
                </button>
              )}
              {end}
            </>
          );
        } else if (pending?.deck === 'ventures' && card && 'income' in card) {
          const max = Math.floor(me.cash / card.cost);
          main = (
            <>
              <input type="number" min={1} max={Math.max(1, max)} value={shares} onChange={(e) => setShares(Number(e.target.value))} aria-label="Сколько долей" />
              <button className="primary" disabled={shares < 1 || shares > max} onClick={() => api.act({ type: 'BUY', shares })}>
                <Icon name="ui-buy" />
                {card.odds !== undefined ? 'Рискнуть' : 'Купить'} долей: {shares} за {money(shares * card.cost)}
              </button>
              {end}
            </>
          );
        } else if (card && 'kind' in card && card.kind === 'asset') {
          const short = card.down - me.cash;
          main = (
            <>
              <button className="primary" disabled={short > 0} onClick={() => api.act({ type: 'BUY' })}>
                <Icon name="ui-buy" />
                Купить за {money(card.down)}
              </button>
              {short > 0 && (() => {
                // «выровнять»: банк добавляет недостающее, и сделка сразу покупается
                const need = Math.ceil(short / step) * step;
                return need <= availableLoan(content, me) ? (
                  <button onClick={() => { api.act({ type: 'TAKE_LOAN', amount: need }); api.act({ type: 'BUY' }); }}>
                    <Icon name="ui-loan-take" />
                    Взять {money(need)} в кредит и купить
                  </button>
                ) : <span className="muted">Не хватает {money(short)}, а банк даст только {money(availableLoan(content, me))}</span>;
              })()}
              {end}
            </>
          );
        } else if (card && 'kind' in card && card.kind === 'bond') {
          main = (
            <>
              <input type="number" min={1} value={shares} onChange={(e) => setShares(Number(e.target.value))} aria-label="Сколько облигаций" />
              <button className="primary" disabled={shares * card.price > me.cash || shares < 1} onClick={() => api.act({ type: 'BUY', shares })}>
                <Icon name="ui-buy" />
                Купить {shares} шт. за {money(shares * card.price)}
              </button>
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
                    <Icon name="ui-buy" />
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
        const income = me.circle === 'inner' ? professionOf(content, me).salary + passiveIncome(content, me) : me.outerIncome;
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

  const loan = myTurn && !reaction && game.phase !== 'roll' && (
    <div className={`loan${moreOpen ? ' open' : ''}`}>
      {me.circle === 'inner' && (
        <button className="ghost" disabled={availableLoan(content, me) < step} onClick={() => api.act({ type: 'TAKE_LOAN', amount: step })}>
          <Icon name="ui-loan-take" />
          Кредит +{money(step)}
        </button>
      )}
      <button className="ghost" disabled={me.bankLoan < step || me.cash < step} onClick={() => api.act({ type: 'REPAY_LOAN', amount: step })}>
        <Icon name="ui-loan-repay" />
        Погасить {money(step)}
      </button>
      {me.bankLoan >= step && me.cash >= 2 * step && (
        <button className="ghost" onClick={() => api.act({ type: 'REPAY_LOAN', amount: Math.min(me.bankLoan, Math.floor(me.cash / step) * step) })}>
          Погасить сколько можно
        </button>
      )}
      <button className="ghost" disabled={me.cash < depositStep} onClick={() => api.act({ type: 'DEPOSIT', amount: depositStep })}>
        <Icon name="ui-deposit" />
        На вклад +{money(depositStep)}
      </button>
      {me.deposit > 0 && (
        <button className="ghost" onClick={() => api.act({ type: 'WITHDRAW', amount: Math.min(me.deposit, depositStep) })}>
          Снять со вклада {money(Math.min(me.deposit, depositStep))}
        </button>
      )}
      {me.bonds.map((b) => (
        <button key={b.id} className="ghost" onClick={() => api.act({ type: 'SELL_BOND', bondId: b.id })}>
          <Icon name="ui-bond" />
          Вернуть «{b.title}» за {money(b.count * b.price)}
        </button>
      ))}
      {me.policies.map((x) => (
        <button key={x.risk} className="ghost" onClick={() => api.act({ type: 'CANCEL_POLICY', risk: x.risk })}>
          Отказаться: {RISK_TITLES[x.risk].toLowerCase()}
        </button>
      ))}
    </div>
  );

  const outcome = myTurn && !reaction ? outcomeOf(game, me, shares) : null;

  return (
    <section className={`actions card${myTurn ? ' my-turn' : ''}`}>
      <h2>
        {myTurn ? 'Ваш ход' : `Ходит ${game.players[game.current]!.name}`}
        <span className="actions-meta">
          <Icon name="ui-wallet" size={14} />{money(me.cash)}
          {myTurn && seconds !== null && <span className={`actions-clock${seconds <= 5 ? ' warn' : ''}`}>{seconds} с</span>}
        </span>
      </h2>
      {awaitingMe && <p className="muted">Ход ждёт вашего решения: продайте по этой цене или пропустите.</p>}
      {outcome && <Outcome outcome={outcome} />}
      {(main || sales.length > 0) && <div className="row wrap">{main}{sales}</div>}
      {!myTurn && sales.length === 0 && <p className="muted">Ждём хода соперника. Если на столе окажется выгодная цена, здесь появится кнопка продажи.</p>}
      {loan && (
        <button className="ghost loan-toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
          {moreOpen ? 'Скрыть кредит и вклад' : 'Кредит, вклад, полисы'}
        </button>
      )}
      {loan}
    </section>
  );
}
