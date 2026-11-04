import { describe, expect, it } from 'vitest';

import { formatPriceShort } from './format';

const plain = (s: string) => s.replace(/\s/g, ' ');

describe('formatPriceShort', () => {
  it('целые рубли — без «,00»', () => {
    expect(plain(formatPriceShort(37_500, 'ru'))).toBe('375 ₽');
    expect(plain(formatPriceShort(100_000, 'ru'))).toBe('1 000 ₽');
    expect(plain(formatPriceShort(0, 'ru'))).toBe('0 ₽');
  });

  it('ненулевые копейки остаются', () => {
    expect(plain(formatPriceShort(1_250, 'ru'))).toBe('12,50 ₽');
    expect(plain(formatPriceShort(35_950, 'ru'))).toBe('359,50 ₽');
  });
});
