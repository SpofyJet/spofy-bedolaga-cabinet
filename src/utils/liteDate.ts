import { uiLocale } from './uiLocale';

type MonthStyle = 'long' | 'short' | '2-digit';

/**
 * Дата без лишнего года: «15 октября», «15 окт.», «15.10» — и с годом, только
 * если он не текущий. Одна функция на все экраны кабинета.
 *
 * Год в подавляющем большинстве случаев лишний: подписки живут месяцами, и
 * человек и так знает, какой сейчас год. Но у длинных подписок год —
 * единственное, что отличает «15 октября» от «15 октября» через год, поэтому
 * его добавляем, когда он действительно несёт смысл.
 */
export function formatSmartDate(
  value: string | null | undefined,
  month: MonthStyle = 'long',
  now: Date = new Date(),
): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(uiLocale(), {
    day: month === '2-digit' ? '2-digit' : 'numeric',
    month,
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Дата словами: «15 октября», «15 октября 2027 г.» — если год не текущий. */
export function formatLiteDate(value: string | null | undefined, now: Date = new Date()): string {
  return formatSmartDate(value, 'long', now);
}
