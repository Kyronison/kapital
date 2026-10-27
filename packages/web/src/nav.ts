import { useSyncExternalStore } from 'react';

/** Разделы кабинета. Адрес раздела живёт в #, поэтому работают «Назад» и ссылки вида /#/rating. */
export type Tab = 'play' | 'training' | 'rating' | 'help' | 'profile';

/** Порядок как в нижней панели телефона. «Как играть» — ссылка в шапке, а не вкладка. */
export const TABS: { id: Tab; title: string; icon: string }[] = [
  { id: 'play', title: 'Играть', icon: 'tab-play' },
  { id: 'training', title: 'Тренировка', icon: 'tab-training' },
  { id: 'rating', title: 'Рейтинг', icon: 'tab-rating' },
  { id: 'help', title: 'Как играть', icon: 'tab-help' },
  { id: 'profile', title: 'Профиль', icon: 'tab-profile' },
];

const parse = (): Tab => {
  const id = location.hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : 'play';
};

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export const useTab = (): Tab => useSyncExternalStore(subscribe, parse);

export const tabHref = (tab: Tab) => `#/${tab}`;

export function go(tab: Tab) {
  if (parse() !== tab) location.hash = `/${tab}`;
}
