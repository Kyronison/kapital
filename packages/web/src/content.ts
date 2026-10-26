import { contentFor, defaultContent, type Content, type GameMode } from '@kapital/content';

/**
 * Правила текущего стола. Режим выбирает создатель в лобби, поэтому клиент пересчитывает
 * правила по режиму из view; модули читают `content` через живую привязку ES-модуля.
 */
export let content: Content = defaultContent;
let current: GameMode = 'classic';

export function applyRules(mode: GameMode | undefined) {
  const next = mode ?? 'classic';
  if (next === current) return;
  current = next;
  content = contentFor(next);
}
