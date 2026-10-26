import { levels, type Level } from '@kapital/content';
import { useState } from 'react';
import { art, Icon } from '../art.js';
import { goalText, isOpen, loadProgress, TIERS } from '../campaign.js';
import { professionTitle } from '../format.js';
import type { TableApi } from '../net.js';

export const Stars = ({ n, of = 3 }: { n: number; of?: number }) => (
  <span className="stars" aria-label={`${n} из ${of} звёзд`}>
    {Array.from({ length: of }, (_, i) => <span key={i} className={i < n ? 'on star-pop' : ''} style={{ animationDelay: `${i * 150}ms` }}>★</span>)}
  </span>
);

/** «Тренировка»: путь из уровней с целью и сроком. Следующий открывается после прохождения предыдущего. */
export function Campaign({ api, name, onBack }: { api: TableApi; name: string; onBack: () => void }) {
  const progress = loadProgress();
  const firstOpen = [...levels].reverse().find((l) => isOpen(l, progress)) ?? levels[0]!;
  const [picked, setPicked] = useState<Level>(firstOpen);
  const total = Object.values(progress).reduce((a, b) => a + b, 0);

  return (
    <main className="campaign">
      <header className="campaign-head">
        <button className="ghost" onClick={onBack}>← Назад</button>
        <h1><Icon name="ui-level" size={28} />Тренировка</h1>
        <span className="muted">Звёзд: {total} из {levels.length * 3}</span>
      </header>
      <div className="campaign-body">
        <ol className="tiers">
          {TIERS.map((tier) => (
            <li key={tier.id} className="tier">
              <h2>{tier.title}</h2>
              <div className="nodes">
                {levels.filter((l) => l.tier === tier.id).map((l) => {
                  const open = isOpen(l, progress);
                  const stars = progress[l.id] ?? 0;
                  return (
                    <button
                      key={l.id}
                      className={`level-node${open ? '' : ' locked'}${stars ? ' done' : ''}${picked.id === l.id ? ' picked' : ''}`}
                      disabled={!open}
                      onClick={() => setPicked(l)}
                      aria-label={`${l.title}${open ? '' : ', закрыт'}`}
                    >
                      {open ? <span className="num">{levels.indexOf(l) + 1}</span> : <Icon name="ui-lock" size={18} />}
                      {stars > 0 && <Stars n={stars} />}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
        <section className="card level-card" key={picked.id}>
          <img src={art(`professions/${picked.professionId}.webp`)} alt="" />
          <span className="muted">{TIERS.find((t) => t.id === picked.tier)!.title} · уровень {levels.indexOf(picked) + 1}</span>
          <h2>{picked.title}</h2>
          <p>{picked.brief}</p>
          <dl>
            <dt>Цель</dt><dd>{goalText(picked)}</dd>
            <dt>Профессия</dt><dd>{professionTitle(picked.professionId)}</dd>
            <dt>Режим</dt><dd>{picked.mode === 'quick' ? 'Быстрый, со стартовым бизнесом' : 'Классика, с нуля'}</dd>
            <dt>Звёзды</dt><dd>3 — за {picked.stars[0]} ходов, 2 — за {picked.stars[1]}, 1 — за {picked.maxTurns}</dd>
          </dl>
          <button className="primary big" onClick={() => api.startLevel(picked.id, name)}>
            {progress[picked.id] ? 'Пройти ещё раз' : 'Начать уровень'}
          </button>
        </section>
      </div>
    </main>
  );
}
