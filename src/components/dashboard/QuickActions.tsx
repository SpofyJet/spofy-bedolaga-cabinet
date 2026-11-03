import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  PiPowerBold,
  PiArrowsClockwiseBold,
  PiWalletBold,
  PiUserPlusBold,
  PiShoppingBagOpenBold,
  PiTicketBold,
} from 'react-icons/pi';
import type { IconType } from 'react-icons';

import { cn } from '@/lib/utils';

/**
 * Быстрые действия главной — всегда ровно четыре одинаковые плитки, чтобы сетка
 * не прыгала между состояниями (было 2/3/4 колонки). Первая — главное действие
 * для текущего состояния и единственная цветная:
 *   доступ есть   → Подключить · Продлить · Пополнить · Пригласить
 *   закончилась   → Продлить · Тарифы · Пополнить · Пригласить
 *   нет подписки  → Тарифы · Пополнить · Промокод · Пригласить
 * Вечной подписке продлевать нечего: вместо «Продлить» — «Тарифы».
 */
export type QuickActionsState = 'active' | 'expired' | 'none';

interface QuickActionsProps {
  state: QuickActionsState;
  renewTo: string;
  connectTo: string;
  /** Вечная подписка (ULTIMA): «Продлить» не предлагаем. */
  lifetime?: boolean;
}

interface Action {
  key: string;
  label: string;
  icon: IconType;
  to: string;
}

export default function QuickActions({
  state,
  renewTo,
  connectTo,
  lifetime = false,
}: QuickActionsProps) {
  const { t } = useTranslation();

  const connect: Action = {
    key: 'connect',
    label: t('dashboard.quick.connect'),
    icon: PiPowerBold,
    to: connectTo,
  };
  const renew: Action = {
    key: 'renew',
    label: t('dashboard.quick.renew'),
    icon: PiArrowsClockwiseBold,
    to: renewTo,
  };
  const plans: Action = {
    key: 'plans',
    label: t('dashboard.quick.plans', 'Тарифы'),
    icon: PiShoppingBagOpenBold,
    to: '/subscription/purchase',
  };
  const topup: Action = {
    key: 'topup',
    label: t('dashboard.quick.topup'),
    icon: PiWalletBold,
    to: '/balance/top-up',
  };
  const promo: Action = {
    key: 'promo',
    label: t('dashboard.useful.promocode', 'Промокод'),
    icon: PiTicketBold,
    to: '/balance?section=promo',
  };
  const invite: Action = {
    key: 'invite',
    label: t('dashboard.quick.invite'),
    icon: PiUserPlusBold,
    to: '/referral',
  };

  const actions =
    state === 'active'
      ? [connect, lifetime ? plans : renew, topup, invite]
      : state === 'expired'
        ? [renew, plans, topup, invite]
        : [plans, topup, promo, invite];

  return (
    <nav
      className="grid grid-cols-4 gap-2.5"
      aria-label={t('dashboard.quick.title', 'Быстрые действия')}
    >
      {actions.map((action, index) => {
        const primary = index === 0;
        return (
          <Link
            key={action.key}
            to={action.to}
            className="group flex flex-col items-center gap-1.5 transition-transform duration-150 active:scale-95"
          >
            <span
              className={cn(
                'flex h-12 w-full max-w-[88px] items-center justify-center rounded-2xl transition-colors duration-200 sm:h-[52px]',
                primary
                  ? 'bg-accent-500 text-on-accent shadow-[0_8px_24px_-10px_rgba(var(--color-accent-500),0.7)] group-hover:bg-accent-600'
                  : 'bg-dark-800/70 text-accent-300 ring-1 ring-inset ring-dark-700/60 group-hover:bg-dark-700/70',
              )}
            >
              <action.icon className="h-5 w-5" />
            </span>
            <span
              className={cn(
                'text-[11.5px] font-semibold leading-none',
                primary ? 'text-dark-50' : 'text-dark-300 group-hover:text-dark-100',
              )}
            >
              {action.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
