import { describe, expect, it } from 'vitest';
import { getMonthlyPriceKopeks } from './pricing';

describe('getMonthlyPriceKopeks', () => {
  it('hides the monthly rate for periods of a month or shorter', () => {
    expect(getMonthlyPriceKopeks(4830, 7)).toBeNull();
    expect(getMonthlyPriceKopeks(9900, 14)).toBeNull();
    expect(getMonthlyPriceKopeks(16030, 30)).toBeNull();
  });

  it('divides by whole months for multiples of 30 days', () => {
    expect(getMonthlyPriceKopeks(30000, 90)).toBe(10000);
    expect(getMonthlyPriceKopeks(60000, 180)).toBe(10000);
  });

  it('counts a year as twelve months and rounds up to whole rubles, as the bot does', () => {
    expect(getMonthlyPriceKopeks(40900, 90)).toBe(13700);
    expect(getMonthlyPriceKopeks(149000, 365)).toBe(12500);
    expect(getMonthlyPriceKopeks(207000, 365)).toBe(17300);
    expect(getMonthlyPriceKopeks(100000, 365)).toBe(8400);
  });

  it('returns null for non-finite input', () => {
    expect(getMonthlyPriceKopeks(Number.NaN, 90)).toBeNull();
    expect(getMonthlyPriceKopeks(30000, Number.NaN)).toBeNull();
    expect(getMonthlyPriceKopeks(30000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
