import type { TFunction } from 'i18next';
import type { WheelPrize } from '../../api/wheel';
import { formatPriceShort } from '@/utils/format';

export { formatPriceShort };

export interface PrizeTextContext {
  discountDays?: number;
  deviceBonusDays?: number;
}

/** Короткая подпись на секторе колеса: «+3 дня», «−10%», «25 ₽». */
export function prizeShortLabel(prize: WheelPrize, t: TFunction): string {
  const value = prize.prize_value ?? 0;
  switch (prize.prize_type) {
    case 'subscription_days':
      return value ? t('wheel.prize.short.days', { count: value }) : prize.display_name;
    case 'discount':
      return value ? `−${value}%` : prize.display_name;
    case 'balance_bonus':
      return value ? formatPriceShort(value) : prize.display_name;
    case 'device_slot':
      return t('wheel.prize.short.device', { count: value || 1 });
    case 'extra_spin':
      return t('wheel.prize.short.extraSpin');
    case 'traffic_gb':
      return value ? `+${value} ${t('wheel.prize.short.gb')}` : prize.display_name;
    case 'nothing':
      return '—';
    default:
      return prize.display_name;
  }
}

/** Название приза в витрине: полнее, чем подпись на секторе. */
export function prizeTitle(prize: WheelPrize, t: TFunction): string {
  const value = prize.prize_value ?? 0;
  if (prize.prize_type === 'discount' && value) return t('wheel.prize.title.discount', { value });
  if (prize.prize_type === 'device_slot')
    return t('wheel.prize.title.device', { count: value || 1 });
  return prizeShortLabel(prize, t);
}

/** Пояснение под призом в витрине «Что может выпасть». */
export function prizeDescription(
  prize: WheelPrize,
  t: TFunction,
  ctx: PrizeTextContext = {},
): string {
  switch (prize.prize_type) {
    case 'subscription_days':
      return t('wheel.prize.desc.days');
    case 'discount':
      return t('wheel.prize.desc.discount', { count: ctx.discountDays ?? 7 });
    case 'balance_bonus':
      return t('wheel.prize.desc.balance');
    case 'device_slot':
      return t('wheel.prize.desc.device', { count: ctx.deviceBonusDays ?? 30 });
    case 'extra_spin':
      return t('wheel.prize.desc.extraSpin');
    case 'traffic_gb':
      return t('wheel.prize.desc.traffic');
    case 'promocode':
      return t('wheel.prize.desc.promocode');
    case 'nothing':
      return t('wheel.prize.desc.nothing');
    default:
      return '';
  }
}

/** Куда вести после выигрыша: экран, где приз пригодится. */
export function prizeAction(prizeType: string | null): { path: string; labelKey: string } | null {
  switch (prizeType) {
    case 'discount':
      return { path: '/subscription/purchase', labelKey: 'wheel.result.useDiscount' };
    case 'subscription_days':
    case 'device_slot':
    case 'traffic_gb':
      return { path: '/subscriptions', labelKey: 'wheel.result.toSubscription' };
    case 'balance_bonus':
      return { path: '/balance', labelKey: 'wheel.result.toBalance' };
    default:
      return null;
  }
}
