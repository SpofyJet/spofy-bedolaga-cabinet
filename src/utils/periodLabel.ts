import { isLifetimePeriod } from './lifetime';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Срок словами: «1 месяц», «3 месяца», «1 год», а не «30 дней». Один вид для
 * покупки, продления, баланса и подарка. Сроки, не кратные месяцу, остаются в днях.
 */
export function formatPeriodLabel(days: number, t: Translate): string {
  if (isLifetimePeriod(days)) return t('subscription.lifetime.forever');
  const key = `landing.periodLabels.d${days}`;
  const result = t(key);
  if (result !== key) return result;

  const months = Math.floor(days / 30);
  const remainder = days % 30;
  if (months > 0 && remainder === 0) {
    return t('landing.periodLabels.nMonths', { count: months });
  }
  return t('landing.periodLabels.nDays', { count: days });
}
