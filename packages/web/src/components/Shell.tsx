import { levels } from '@kapital/content';
import type { ReactNode } from 'react';
import { Icon, Logo, PLAYER_COLORS } from '../art.js';
import { useProgress } from '../campaign-progress.js';
import { TABS, tabHref, type Tab } from '../nav.js';
import { useRating } from '../rating.js';

/** Круг с первой буквой имени. Цвет постоянный для имени; позже сюда встанут картинки-аватары. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hash = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.44, background: PLAYER_COLORS[hash % 5] }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Кабинет после входа: шапка с разделами и плашкой игрока, на телефоне — нижняя панель.
 * Во время партии и в лобби его нет: там свой экран на всю ширину.
 */
export function Shell({ tab, name, children }: { tab: Tab; name: string; children: ReactNode }) {
  const progress = useProgress();
  const rating = useRating();
  const stars = Object.values(progress).reduce((a, b) => a + b, 0);
  const place = rating?.me.place;

  return (
    <>
      <header className="shell-top">
        <a className="brand" href={tabHref('play')} aria-label="Капитал: на главную"><Logo /></a>
        <nav className="tabs" aria-label="Разделы">
          {TABS.filter((t) => t.id !== 'profile').map((t) => (
            <a key={t.id} href={tabHref(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={20} />
              {t.title}
            </a>
          ))}
        </nav>
        <a className="me-chip" href={tabHref('profile')} aria-current={tab === 'profile' ? 'page' : undefined} title="Профиль">
          <Avatar name={name} />
          <span className="me-text">
            <strong>{name}</strong>
            <small>
              <span className="me-stars">★ {stars}<span className="muted">/{levels.length * 3}</span></span>
              <span className="me-place"><Icon name="ui-trophy" size={13} />{place ? `${place} место` : 'без места'}</span>
            </small>
          </span>
        </a>
      </header>
      <main className={`cabinet cabinet-${tab}`}>{children}</main>
      <nav className="bottom-nav" aria-label="Разделы">
        {TABS.map((t) => (
          <a key={t.id} href={tabHref(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <Icon name={t.icon} size={24} />
            <span>{t.title}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
