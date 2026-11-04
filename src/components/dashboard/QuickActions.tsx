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

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Быстрые действия главной. При подписке — четыре плитки, первая — главное
 * действие для состояния и единственная залитая — кораллом, «каплей» тёплого
 * на синем (spofy/tones.ts). Остальные спокойные, синие: рядом с каплей
 * не должно быть других ярких цветов, иначе она теряется:
 *   доступ есть   → Подключить · Продлить · Пополнить · Пригласить
 *   закончилась   → Продлить · Тарифы · Пополнить · Пригласить
 * Вечной подписке продлевать нечего: вместо «Продлить» — «Тарифы».
 *
 * Нет подписки → Пополнить · Промокод · Пригласить, все спокойные. Главное
 * действие этого экрана — пробный период или кнопка покупки под карточками;
 * цветная плитка «Тарифы» вела туда же и делала из экрана три кнопки «купить».
 */
export type QuickActionsState = 'active' | 'expired' | 'none';

interface QuickActionsProps {
  state: QuickActionsState;
  renewTo: string;
  connectTo: string;
  /** Вечная подписка (ULTIMA): «Продлить» не предлагаем. */
  lifetime?: boolean;
  /** Состояние доступа ещё не известно: четыре пустые плитки того же размера,
   *  а не набор кнопок для «закончилась», который через миг сменится. */
  loading?: boolean;
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
  loading = false,
}: QuickActionsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2.5" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-12 w-full max-w-[88px] rounded-2xl sm:h-[52px]" />
            <Skeleton className="h-[11.5px] w-14" />
          </span>
        ))}
      </div>
    );
  }

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
        : [topup, promo, invite];
  const hasPrimary = state !== 'none';

  return (
    <nav
      className={cn('grid gap-2.5', actions.length === 3 ? 'grid-cols-3' : 'grid-cols-4')}
      aria-label={t('dashboard.quick.title', 'Быстрые действия')}
    >
      {actions.map((action, index) => {
        const primary = hasPrimary && index === 0;
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
                  ? 'bg-cta-500 text-on-cta shadow-[0_8px_24px_-10px_rgba(255,138,42,0.6)] group-hover:bg-cta-600'
                  : 'bg-accent-500/[0.18] text-accent-200 ring-1 ring-inset ring-accent-400/30 group-hover:bg-accent-500/25 light:bg-accent-500/10 light:text-accent-600 light:ring-accent-500/20',
              )}
            >
              <action.icon className="h-5 w-5" />
            </span>
            <span
              className={cn(
                'text-[11.5px] font-semibold leading-none',
                primary ? 'text-dark-50' : 'text-dark-200 group-hover:text-dark-50',
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
