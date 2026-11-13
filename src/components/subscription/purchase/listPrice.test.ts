import { describe, expect, it } from 'vitest';
import { listPricePeriod } from './listPrice';

const period = (days: number, price: number) => ({ days, price_kopeks: price });

describe('listPricePeriod', () => {
  it('в карточке тарифа стоит цена за 30 дней, а не самого короткого срока', () => {
    // «Стандартный» на 13.11.2026: две недели дешевле месяца, но сравнивают по месяцу.
    const listed = listPricePeriod({
      periods: [period(14, 15900), period(30, 17900), period(60, 31900)],
    });
    expect(listed?.isMonth).toBe(true);
    expect(listed?.period.price_kopeks).toBe(17900);
  });

  it('нет срока на 30 дней — первый срок, и это «от»', () => {
    const listed = listPricePeriod({ periods: [period(90, 40900), period(180, 78900)] });
    expect(listed?.isMonth).toBe(false);
    expect(listed?.period.days).toBe(90);
  });

  it('без сроков цены нет', () => {
    expect(listPricePeriod({ periods: [] })).toBeNull();
  });
});
