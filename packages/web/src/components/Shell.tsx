import type { ReactNode } from 'react';
import { art, Icon, Logo, PLAYER_COLORS } from '../art.js';
import { TABS, tabHref, type Tab } from '../nav.js';
import { LegalFooter } from './Legal.js';

/** Аватар игрока из набора; без него (боты, чужие сохранения) — круг с первой буквой имени. */
export function Avatar({ name, avatar, size = 36 }: { name: string; avatar?: string | null; size?: number }) {
  if (avatar) return <img className="avatar avatar-img" src={art(`avatars/${avatar}.webp`)} style={{ width: size, height: size }} alt="" />;
  const hash = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.44, background: PLAYER_COLORS[hash % 5] }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Кабинет после входа: шапка с разделами, «Как играть» и кнопкой профиля; на телефоне — нижняя панель.
 * Статистики в шапке нет: она в профиле и рейтинге.
 * Во время партии и в лобби его нет: там свой экран на всю ширину.
 */
export function Shell({ tab, name, avatar, children }: { tab: Tab; name: string; avatar: string | null; children: ReactNode }) {
  const help = TABS.find((t) => t.id === 'help')!;
  const main = TABS.filter((t) => t.id !== 'help' && t.id !== 'profile');

  return (
    <>
      <header className="shell-top">
        <a className="brand" href={tabHref('play')} aria-label="Капитал: на главную"><Logo /></a>
        <nav className="tabs" aria-label="Разделы">
          {main.map((t) => (
            <a key={t.id} href={tabHref(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={20} />
              {t.title}
            </a>
          ))}
        </nav>
        <a className="help-link" href={tabHref('help')} aria-current={tab === 'help' ? 'page' : undefined} aria-label={help.title}>
          <Icon name={help.icon} size={20} />
          <span>{help.title}</span>
        </a>
        <a className="me-chip" href={tabHref('profile')} aria-current={tab === 'profile' ? 'page' : undefined}>
          <Avatar name={name} avatar={avatar} />
          <span className="me-text">
            <strong>{name}</strong>
            <small>Профиль</small>
          </span>
        </a>
      </header>
      <main className={`cabinet cabinet-${tab}`}>{children}<LegalFooter /></main>
      <nav className="bottom-nav" aria-label="Разделы">
        {TABS.filter((t) => t.id !== 'help').map((t) => (
          <a key={t.id} href={tabHref(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <Icon name={t.icon} size={24} />
            <span>{t.title}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
