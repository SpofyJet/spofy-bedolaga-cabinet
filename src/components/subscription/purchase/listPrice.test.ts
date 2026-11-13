import { describe, expect, it } from 'vitest';
import { defaultPeriod, listPricePeriod } from './listPrice';

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

describe('defaultPeriod', () => {
  it('без отметки оператора заранее выбран месяц, а не две недели', () => {
    // «Стандартный»: первый срок — 14 дней за 159 ₽, карточка тарифа пишет «179 ₽ за 30 дней».
    const chosen = defaultPeriod([period(14, 15900), period(30, 17900), period(60, 31900)]);
    expect(chosen?.days).toBe(30);
  });

  it('отметка оператора «Выгодно» важнее месяца', () => {
    const chosen = defaultPeriod([
      period(14, 15900),
      period(30, 17900),
      { ...period(90, 40900), is_highlighted: true },
    ]);
    expect(chosen?.days).toBe(90);
  });

  it('нет ни отметки, ни 30 дней — первый срок, как раньше', () => {
    expect(defaultPeriod([period(2222, 579000)])?.days).toBe(2222);
    expect(defaultPeriod([])).toBeUndefined();
  });
});
