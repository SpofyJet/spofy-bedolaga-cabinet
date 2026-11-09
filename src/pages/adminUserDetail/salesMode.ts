import type { UserDetailResponse, UserSubscriptionInfo } from '@/api/adminUsers';

/**
 * Как у человека устроены подписки — от этого зависят плитки карточки:
 * - `tariffs` — одна подписка по тарифу;
 * - `multi` — мультитариф: подписок несколько, «срок / трафик» одной из них
 *   в плитках над вкладками вводили бы в заблуждение.
 */
export type SalesMode = 'tariffs' | 'multi';

type ModeSource = Pick<UserDetailResponse, 'multi_tariff_enabled' | 'subscriptions'>;

export function salesModeOf(user: ModeSource): SalesMode {
  if (user.multi_tariff_enabled ?? user.subscriptions.length > 1) return 'multi';
  return 'tariffs';
}

/** Живая подписка — ей можно пользоваться (активна, пробная или упёрлась в трафик). */
export function isLiveSubscription(
  sub: Pick<UserSubscriptionInfo, 'status' | 'is_active'>,
): boolean {
  return sub.is_active || sub.status === 'trial' || sub.status === 'limited';
}
