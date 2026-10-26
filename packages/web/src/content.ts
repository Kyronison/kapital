import { contentFor, contentForLevel, defaultContent, levels, type Content, type GameMode } from '@kapital/content';

/**
 * Правила текущего стола. Режим выбирает создатель в лобби, у уровня «Тренировки» правила свои,
 * поэтому клиент пересчитывает их по view; модули читают `content` через живую привязку ES-модуля.
 */
export let content: Content = defaultContent;
let current = 'classic';

export function applyRules(mode: GameMode | undefined, levelId?: string | null) {
  const next = levelId ? `level:${levelId}` : mode ?? 'classic';
  if (next === current) return;
  current = next;
  const level = levelId ? levels.find((l) => l.id === levelId) : undefined;
  content = level ? contentForLevel(level) : contentFor(mode ?? 'classic');
}
