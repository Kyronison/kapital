import { chapters, levels, type Level } from '@kapital/content';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { art, Icon } from '../art.js';
import { chapterOf, currentLevel, goalText, isOpen, TIERS } from '../campaign.js';
import { useProgress } from '../campaign-progress.js';
import { MAP_DESKTOP, MAP_MOBILE } from '../campaign-map.js';
import { content } from '../content.js';
import { professionTitle } from '../format.js';
import type { TableApi } from '../net.js';
import { LearningOptions } from './LearningOptions.js';

export const Stars = ({ n, of = 3 }: { n: number; of?: number }) => (
  <span className="stars stars-pop" aria-label={`${n} из ${of} звёзд`}>
    {Array.from({ length: of }, (_, i) => <span key={i} className={i < n ? 'on star-pop' : ''}>★</span>)}
  </span>
);

const narrow = window.matchMedia('(max-width: 800px)');
const useNarrow = () => useSyncExternalStore((cb) => {
  narrow.addEventListener('change', cb);
  return () => narrow.removeEventListener('change', cb);
}, () => narrow.matches);

/** «Тренировка»: путь из уровней с целью и сроком. Следующий открывается после прохождения предыдущего. */
export function Campaign({ api }: { api: TableApi }) {
  const progress = useProgress();
  const firstOpen = currentLevel(progress);
  const [picked, setPicked] = useState<Level>(firstOpen);
  const [chapter, setChapter] = useState(chapterOf(firstOpen));
  // прогресс приходит из аккаунта чуть позже первого рендера: выбранный уровень подтягивается за ним
  useEffect(() => {
    setPicked(firstOpen);
    setChapter(chapterOf(firstOpen));
  }, [firstOpen]);
  const total = Object.values(progress).reduce((a, b) => a + b, 0);
  const map = useNarrow() ? MAP_MOBILE : MAP_DESKTOP;
  const own = chapters[chapter]!.levels;
  const pickChapter = (i: number) => {
    setChapter(i);
    const ls = chapters[i]!.levels;
    setPicked(ls.find((l) => isOpen(l, progress) && !progress[l.id]) ?? ls[0]!);
  };

  return (
    <div className="campaign">
      <header className="campaign-head">
        <h1><Icon name="ui-level" size={28} />Тренировка</h1>
        <span className="muted">Пройдено {Object.keys(progress).length} из {levels.length} · звёзд {total} из {levels.length * 3}</span>
      </header>
      <div className="chapter-tabs" role="tablist" aria-label="Части тренировки">
        {chapters.map((c, i) => {
          const done = c.levels.filter((l) => progress[l.id]).length;
          return (
            <button key={c.title} role="tab" aria-selected={i === chapter} className={i === chapter ? 'active' : ''} onClick={() => pickChapter(i)}>
              <strong>{c.title}</strong><small className="muted">{done} из {c.levels.length}</small>
            </button>
          );
        })}
      </div>
      <ul className="tier-badges">
        {TIERS.map((tier) => {
          const tierLevels = own.filter((l) => l.tier === tier.id);
          const open = isOpen(tierLevels[0]!, progress);
          const stars = tierLevels.reduce((a, l) => a + (progress[l.id] ?? 0), 0);
          return (
            <li key={tier.id} className={open ? '' : 'locked'}>
              <img src={art(`campaign/badges/${tier.id}${open ? '' : '-locked'}.webp`)} alt="" />
              <span><strong>{tier.title}</strong><small className="muted">{stars} из {tierLevels.length * 3} ★</small></span>
            </li>
          );
        })}
      </ul>
      <div className="campaign-body" style={{ ['--panel' as string]: `${map.panel * 100}%`, ['--map-ratio' as string]: map.ratioValue }}>
        <div className={`campaign-map chapter-${chapter + 1}`} style={{ aspectRatio: map.ratio, backgroundImage: `url(${art(map.file)})` }}>
          {own.map((l, k) => {
            const [x, y] = map.nodes[k % map.nodes.length]!;
            const i = levels.indexOf(l);
            const open = isOpen(l, progress);
            const stars = progress[l.id] ?? 0;
            return (
              <button
                key={l.id}
                className={`level-node${open ? '' : ' locked'}${stars ? ' done' : ''}${picked.id === l.id ? ' picked' : ''}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                disabled={!open}
                onClick={() => setPicked(l)}
                aria-label={`Уровень ${i + 1}: ${l.title}${open ? '' : `, откроется после уровня ${i}`}`}
                title={open ? `${i + 1}. ${l.title}` : `Пройдите уровень ${i}`}
              >
                {open ? <span className="num">{i + 1}</span> : <Icon name="ui-lock" size={16} />}
                {stars > 0 && <Stars n={stars} />}
              </button>
            );
          })}
        </div>
        <section className="card level-card" key={picked.id}>
          <img src={art(`professions/${picked.professionId}.webp`)} alt="" />
          <span className="muted">{TIERS.find((t) => t.id === picked.tier)!.title} · уровень {levels.indexOf(picked) + 1}</span>
          <h2>{picked.title}</h2>
          <p>{picked.brief}</p>
          <dl>
            <dt>Цель</dt><dd>{goalText(picked)}</dd>
            <dt>Профессия</dt><dd>{professionTitle(picked.professionId)}<small className="muted">{content.professions.find((p) => p.id === picked.professionId)?.about}</small></dd>
            <dt>Режим</dt><dd>{picked.mode === 'quick' ? 'Быстрый, со стартовым бизнесом' : 'Классика, с нуля'}</dd>
            <dt>Звёзды</dt><dd>3 — за {picked.stars[0]} ходов, 2 — за {picked.stars[1]}, 1 — за {picked.maxTurns}</dd>
          </dl>
          <LearningOptions />
          <button className="primary big" onClick={() => api.startLevel(picked.id)}>
            {progress[picked.id] ? 'Пройти ещё раз' : 'Начать уровень'}
          </button>
        </section>
      </div>
    </div>
  );
}
