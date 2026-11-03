/**
 * Вечная подписка (тариф ULTIMA).
 *
 * Продаётся одним периодом в 2222 дня, а бэкенд хранит её с концом
 * 2099-12-31T23:59:59Z и отдаёт признак `is_lifetime`. Признак есть не везде:
 * списки, «простые» эндпоинты и сообщения веб-сокета его не несут, поэтому
 * вечную подписку узнаём и по дате конца.
 *
 * Человек про такую подписку должен видеть «Навсегда» — не «2222 дня», не
 * «до 31.12.2099» и не «осталось 26 000 дней», — и ему не предлагают продлить.
 */

/** Период от этого числа дней — вечный: обычные периоды кончаются на годах. */
export const LIFETIME_MIN_DAYS = 2000;

/** Год конца, начиная с которого подписка считается вечной (у вечной — 2099). */
const LIFETIME_MIN_YEAR = 2090;

/** Вечный ли период тарифа (или остаток дней). */
export function isLifetimePeriod(days: number | null | undefined): boolean {
  return typeof days === 'number' && Number.isFinite(days) && days >= LIFETIME_MIN_DAYS;
}

/** Вечная ли дата конца подписки. */
export function isLifetimeEndDate(endDate?: string | null): boolean {
  if (!endDate) return false;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCFullYear() >= LIFETIME_MIN_YEAR;
}

export interface LifetimeCandidate {
  is_lifetime?: boolean | null;
  end_date?: string | null;
}

/** Вечная ли подписка: по признаку бэкенда, а без него — по дате конца. */
export function isLifetimeSubscription(sub: LifetimeCandidate | null | undefined): boolean {
  return sub?.is_lifetime === true || isLifetimeEndDate(sub?.end_date);
}
