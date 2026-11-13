/** Цена какого срока стоит в списке тарифов: по ней тарифы сравнивают между собой (как в боте). */
export const LIST_PRICE_PERIOD_DAYS = 30;

/**
 * Срок, цену которого показывает карточка тарифа. Есть 30 дней — он: «179 ₽ за 30 дней»
 * у «Стандартного» честно сравнивается с «310 ₽ за 30 дней» у «С Обходами». Раньше
 * стояло «от 159 ₽» (цена двух недель) рядом с «от 310 ₽» (цена месяца), а бот в том же
 * списке уже писал цену за 30 дней. Срока на 30 дней нет — первый срок, с «от».
 */
export function listPricePeriod<P extends { days: number }>(tariff: {
  periods: P[];
}): { period: P; isMonth: boolean } | null {
  const month = tariff.periods.find((period) => period.days === LIST_PRICE_PERIOD_DAYS);
  if (month) return { period: month, isMonth: true };
  const first = tariff.periods[0];
  return first ? { period: first, isMonth: false } : null;
}

/**
 * Срок, выбранный заранее в форме покупки и в подарке. Сначала отметка оператора
 * «Выгодно», затем 30 дней, затем первый по счёту. Раньше без отметки брался первый —
 * у «Стандартного» это две недели за 159 ₽, хотя карточка тарифа, с которой человек
 * пришёл, пишет «179 ₽ за 30 дней»: кто не посмотрел на срок, покупал две недели
 * почти по цене месяца.
 */
export function defaultPeriod<P extends { days: number; is_highlighted?: boolean | null }>(
  periods: readonly P[] | null | undefined,
): P | undefined {
  if (!periods || periods.length === 0) return undefined;
  return (
    periods.find((period) => Boolean(period.is_highlighted)) ??
    periods.find((period) => period.days === LIST_PRICE_PERIOD_DAYS) ??
    periods[0]
  );
}
