import type { Tariff } from '@/types';

/**
 * Тариф, который кабинет отмечает «Советуем», когда оператор сам ничего не выделил.
 *
 * Это «С Обходами». Основание — данные бота на 12.11.2026:
 *  - за 60 дней на него перешли со «Стандартного» 84 раза, обратно — 3;
 *  - купившие его первым приносят 656 ₽ на человека против 403 ₽ у «Стандартного»,
 *    а остаются примерно так же (54 % против 61 %, разница в пределах погрешности).
 *
 * Отдельный номер, а не признак `is_highlighted` в базе: тот же признак в боте
 * дописывает к тарифу «⭐ выгодно», а меню бота меняется только по слову владельца.
 * Если оператор выделит тариф сам — отметка уходит к нему.
 */
export const RECOMMENDED_TARIFF_ID = 3;

/** Номер тарифа с отметкой «Советуем» среди показанных; null — отмечать нечего. */
export function recommendedTariffId(
  tariffs: ReadonlyArray<Pick<Tariff, 'id' | 'is_highlighted'>>,
): number | null {
  const marked = tariffs.find((tariff) => Boolean(tariff.is_highlighted));
  if (marked) return marked.id;
  // Отмечаем, только когда есть из чего выбирать: у единственного тарифа советовать нечего.
  if (tariffs.length < 2) return null;
  return tariffs.some((tariff) => tariff.id === RECOMMENDED_TARIFF_ID)
    ? RECOMMENDED_TARIFF_ID
    : null;
}
