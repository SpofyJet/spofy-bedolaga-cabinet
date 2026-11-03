import { describe, expect, it } from 'vitest';
import {
  isLifetimeEndDate,
  isLifetimePeriod,
  isLifetimeSubscription,
  LIFETIME_MIN_DAYS,
} from './lifetime';
import { getMonthlyPriceKopeks } from './pricing';
import { showsAutopayToggle } from './legacySubscription';

/**
 * Вечная подписка (ULTIMA): продаётся периодом 2222 дня, хранится с концом
 * 2099-12-31. Признак `is_lifetime` есть не во всех ответах API, поэтому
 * помощники узнают её и по дате, и по длине периода.
 */

const LIFETIME_END = '2099-12-31T23:59:59Z';

describe('isLifetimePeriod', () => {
  it('2222 дня — навсегда', () => {
    expect(isLifetimePeriod(2222)).toBe(true);
    expect(isLifetimePeriod(LIFETIME_MIN_DAYS)).toBe(true);
  });

  it('обычные периоды и остатки — не навсегда', () => {
    for (const days of [0, 1, 30, 90, 365, 730, 1825, LIFETIME_MIN_DAYS - 1]) {
      expect(isLifetimePeriod(days)).toBe(false);
    }
  });

  it('пустое и нечисловое — не навсегда', () => {
    expect(isLifetimePeriod(null)).toBe(false);
    expect(isLifetimePeriod(undefined)).toBe(false);
    expect(isLifetimePeriod(Number.NaN)).toBe(false);
  });

  it('остаток дней вечной подписки (~26 000) — тоже навсегда', () => {
    expect(isLifetimePeriod(26_000)).toBe(true);
  });
});

describe('isLifetimeEndDate', () => {
  it('конец в 2099-м — вечная', () => {
    expect(isLifetimeEndDate(LIFETIME_END)).toBe(true);
    expect(isLifetimeEndDate('2090-01-01T00:00:00Z')).toBe(true);
  });

  it('обычная дата, пустое и мусор — не вечная', () => {
    expect(isLifetimeEndDate('2026-12-31T23:59:59Z')).toBe(false);
    expect(isLifetimeEndDate('2089-12-31T23:59:59Z')).toBe(false);
    expect(isLifetimeEndDate(null)).toBe(false);
    expect(isLifetimeEndDate(undefined)).toBe(false);
    expect(isLifetimeEndDate('')).toBe(false);
    expect(isLifetimeEndDate('not-a-date')).toBe(false);
  });
});

describe('isLifetimeSubscription', () => {
  it('верит признаку бэкенда', () => {
    expect(isLifetimeSubscription({ is_lifetime: true, end_date: '2026-12-01T00:00:00Z' })).toBe(
      true,
    );
  });

  it('без признака (списки, lite, веб-сокет) узнаёт по дате конца', () => {
    expect(isLifetimeSubscription({ end_date: LIFETIME_END })).toBe(true);
    expect(isLifetimeSubscription({ is_lifetime: false, end_date: LIFETIME_END })).toBe(true);
  });

  it('обычная подписка и её отсутствие — не вечные', () => {
    expect(isLifetimeSubscription({ end_date: '2026-12-01T00:00:00Z' })).toBe(false);
    expect(isLifetimeSubscription({ is_lifetime: false, end_date: null })).toBe(false);
    expect(isLifetimeSubscription(null)).toBe(false);
    expect(isLifetimeSubscription(undefined)).toBe(false);
  });
});

describe('вечная подписка в соседних помощниках', () => {
  it('цену «в месяц» для вечного периода не считаем', () => {
    expect(getMonthlyPriceKopeks(500_000, 2222)).toBeNull();
    expect(getMonthlyPriceKopeks(120_000, 365)).toBe(Math.round((120_000 * 30) / 365));
  });

  it('тумблера автопродления у вечной подписки нет', () => {
    expect(showsAutopayToggle({ is_trial: false, is_daily: false, is_lifetime: true })).toBe(false);
    expect(showsAutopayToggle({ is_trial: false, is_daily: false, end_date: LIFETIME_END })).toBe(
      false,
    );
    expect(
      showsAutopayToggle({ is_trial: false, is_daily: false, end_date: '2026-12-01T00:00:00Z' }),
    ).toBe(true);
  });
});
