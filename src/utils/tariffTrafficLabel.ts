import type { TFunction } from 'i18next';

/**
 * The numeric API limit is language-independent; cached labels may use the profile language.
 *
 * У тарифа с обходами лимит — квота только на серверы «Обход», обычные серверы без
 * лимита: «Безлимит + 50 ГБ обходов», а не «50 ГБ» (так рекомендуемый тариф
 * выглядел хуже соседнего с «Безлимит»).
 */
export function tariffTrafficLabel(gb: number, t: TFunction, bypassQuota = false): string {
  if (gb === 0) return t('subscription.unlimited', 'Безлимит');
  if (bypassQuota) {
    return t('subscription.bypassQuotaTariff', {
      gb,
      defaultValue: 'Безлимит + {{gb}} ГБ обходов',
    });
  }
  return `${gb} ${t('common.units.gb', 'ГБ')}`;
}
