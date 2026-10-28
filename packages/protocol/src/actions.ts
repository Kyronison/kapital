import type { Action } from '@kapital/engine';

/** Действие движка, как его присылает клиент: без playerId, его подставляет сервер по соединению. */
export type ClientAction = Action extends infer A ? (A extends Action ? Omit<A, 'playerId'> : never) : never;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

type Check = (m: Record<string, unknown>) => string | null;

/** Какие поля допустимы у каждого действия и чем они должны быть. Лишние поля отбрасываются. */
const SHAPES: Record<ClientAction['type'], { fields: string[]; check: Check }> = {
  ROLL: { fields: ['dice'], check: (m) => (m.dice === undefined || m.dice === 1 || m.dice === 2 ? null : 'Бросают один или два кубика') },
  CHOOSE_DEAL: { fields: ['size'], check: (m) => (m.size === 'small' || m.size === 'big' ? null : 'Сделка бывает малая или крупная') },
  BUY: { fields: ['shares'], check: (m) => (m.shares === undefined || isInt(m.shares) ? null : 'Число долей должно быть целым') },
  SELL_STOCK: { fields: ['shares'], check: (m) => (isInt(m.shares) ? null : 'Число акций должно быть целым') },
  SELL_ASSET: { fields: ['assetId'], check: (m) => (isStr(m.assetId) ? null : 'Не указан актив') },
  DONATE: { fields: [], check: () => null },
  BUY_DREAM: { fields: [], check: () => null },
  TAKE_LOAN: { fields: ['amount'], check: (m) => (isInt(m.amount) ? null : 'Сумма должна быть целой') },
  REPAY_LOAN: { fields: ['amount'], check: (m) => (isInt(m.amount) ? null : 'Сумма должна быть целой') },
  DEPOSIT: { fields: ['amount'], check: (m) => (isInt(m.amount) ? null : 'Сумма должна быть целой') },
  WITHDRAW: { fields: ['amount'], check: (m) => (isInt(m.amount) ? null : 'Сумма должна быть целой') },
  SELL_BOND: { fields: ['bondId'], check: (m) => (isStr(m.bondId) ? null : 'Не указаны облигации') },
  CANCEL_POLICY: { fields: ['risk'], check: (m) => (m.risk === 'health' || m.risk === 'property' ? null : 'Неизвестный полис') },
  CHOOSE: { fields: ['option'], check: (m) => (isInt(m.option) && m.option >= 0 && m.option < 8 ? null : 'Неизвестный вариант') },
  END_TURN: { fields: [], check: () => null },
};

/**
 * Проверяет форму действия от клиента. Смысл (свой ли ход, хватает ли денег) проверяет движок;
 * здесь отсекаются сообщения, которых честный клиент не шлёт: не тот тип, не те поля, не те значения.
 */
export function parseClientAction(message: unknown): Parsed<ClientAction> {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) return { ok: false, error: 'Неверное действие' };
  const m = message as Record<string, unknown>;
  const type = m.type;
  if (typeof type !== 'string' || !Object.hasOwn(SHAPES, type)) return { ok: false, error: 'Неизвестное действие' };
  const shape = SHAPES[type as ClientAction['type']];
  if ('playerId' in m) return { ok: false, error: 'Игрока определяет сервер' };
  const error = shape.check(m);
  if (error) return { ok: false, error };
  const value: Record<string, unknown> = { type };
  for (const f of shape.fields) if (m[f] !== undefined) value[f] = m[f];
  return { ok: true, value: value as ClientAction };
}
