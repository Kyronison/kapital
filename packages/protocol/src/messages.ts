import type { GameMode } from '@kapital/content';
import type { GameEvent, GameState } from '@kapital/engine';

/**
 * Протокол между сервером и клиентом. Сервер и клиент импортируют эти типы, поэтому поле,
 * добавленное в `view`, нельзя забыть в клиенте, и наоборот.
 *
 * Сообщения клиента: `hello`, `action`, `start`, `add_bot`, `set_mode`, `set_turn_seconds`, `pass`, `chat`.
 * Сообщения сервера: `view` всем, `events` всем, `chat` всем, `seat` и `error` своему клиенту.
 */

export interface Seat {
  id: string;
  name: string;
  professionId: string | null;
  dreamId: string | null;
  bot: boolean;
  connected: boolean;
}

/** Партия без порядка колод и состояния ГПСЧ, иначе можно предсказать карты и кубики. */
export type PublicGame = Omit<GameState, 'decks' | 'rng' | 'seed'>;

export interface ChatMessage {
  n: number;
  seatId: string;
  name: string;
  text: string;
  at: number;
}

/** Итог уровня «Тренировки»: null, пока партия идёт. */
export interface LevelView {
  id: string;
  /** Насколько цель выполнена, от 0 до 1. */
  share: number;
  result: { passed: true; stars: 1 | 2 | 3; turns: number } | { passed: false } | null;
}

/**
 * Окно ответа: текущий игрок закончил ход, а на столе цена, по которой соперники-люди
 * могут продать свои акции или активы. Ход перейдёт, когда все ответят или выйдет время.
 */
export interface ReactionView {
  until: number;
  /** Места, от которых ждём продажи или «Не продавать». */
  waiting: string[];
}

/** Стол без скрытых данных. Чат приходит отдельно: он меняется реже, чем партия. */
export interface TableView {
  hostId: string | null;
  reaction: ReactionView | null;
  mode: GameMode;
  /** Секунд на ход человека; 0 — без таймера. Выбирает создатель стола в лобби. */
  turnSeconds: number;
  level: LevelView | null;
  seats: Seat[];
  game: PublicGame | null;
  /** Когда истекает ход текущего игрока-человека, мс; null — таймера нет. */
  turnDeadline: number | null;
}

/** Место за столом, которое получил клиент: по ключу он вернётся на него после перерыва. */
export interface SeatTicket {
  seatId: string;
  key: string;
  /** Номер сохранения: по нему партию поднимают после перезапуска сервера. */
  saveId: string;
}

export interface ServerMessages {
  view: TableView;
  events: GameEvent[];
  /** Все сообщения чата при входе, затем по одному новому. */
  chat: ChatMessage[];
  seat: SeatTicket;
  error: { error: string };
}

/** Сколько секунд даётся на ход; 0 — без таймера. */
export const TURN_SECONDS_OPTIONS = [30, 60, 90, 0] as const;
export const DEFAULT_TURN_SECONDS = 30;

export interface JoinOptions {
  name?: string;
  professionId?: string;
  dreamId?: string;
  /** Ключ места: с ним клиент возвращается в сохранённую партию. */
  key?: string;
}

/** Параметры создания комнаты: restore — номер сохранённой партии, levelId — уровень «Тренировки». */
export interface CreateOptions {
  restore?: string;
  levelId?: string;
}
