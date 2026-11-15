import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Subscription } from '../../types';
import {
  canOpenTariffSwitch,
  needsTariff,
  tariffSelectionPath,
} from '../../utils/legacySubscription';
import { isLifetimeSubscription } from '../../utils/lifetime';
import { cn } from '@/lib/utils';

/** Ссылка в виде кнопки Spofy (та же форма, что у Button из spofy/ui). */
function linkButton(tone: 'primary' | 'secondary', extra?: string) {
  return cn(
    'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-center text-[15px] font-semibold leading-tight transition-colors active:scale-[0.98]',
    tone === 'primary'
      ? 'bg-cta-500 text-on-cta hover:bg-cta-600'
      : 'bg-dark-800/70 text-dark-100 hover:bg-dark-700/70',
    extra,
  );
}

interface PurchaseCTAButtonProps {
  subscription: Subscription | null;
}

export default function PurchaseCTAButton({ subscription }: PurchaseCTAButtonProps) {
  const { t } = useTranslation();

  const isExpired =
    !subscription ||
    (!subscription.is_active && !subscription.is_trial && !subscription.is_limited);
  const isTrial = subscription?.is_trial;
  const isDaily = subscription?.is_daily;
  // Старая подписка (куплена в классике, тарифа нет): продлить нельзя — ведём на витрину тарифов.
  const requiresTariff = needsTariff(subscription);
  // Вечная подписка (ULTIMA) не кончается: «Продлить» ей не предлагаем.
  const isLifetime = isLifetimeSubscription(subscription);

  if (subscription && canOpenTariffSwitch(subscription)) {
    const showRenew = !isDaily && !isLifetime;
    // Два синих блока подряд («Подключить устройство» в карточке и «Продлить»)
    // спорили за внимание. Пока до конца больше недели, продление — спокойная
    // кнопка; синей она становится, когда срок и правда подходит.
    const renewUrgent =
      !subscription.is_active || subscription.is_trial || subscription.days_left <= 7;
    return (
      <div className={cn('grid gap-2', showRenew && 'sm:grid-cols-2')}>
        {showRenew && (
          <Link
            to={`/subscriptions/${subscription.id}/renew`}
            className={linkButton(renewUrgent ? 'primary' : 'secondary')}
          >
            {t('subscription.extend')}
          </Link>
        )}
        <Link to={tariffSelectionPath(subscription.id)} className={linkButton('secondary')}>
          {t('subscription.switchTariff.title')}
        </Link>
      </div>
    );
  }

  if (isLifetime && !isExpired) return null;

  // Пробной — «Оформить подписку», теми же словами, что на главной: раньше здесь
  // стоял заголовок плашки «Выберите тариф для продолжения».
  const buttonText = requiresTariff
    ? t('subscription.cta.moveToTariff')
    : isExpired || isTrial
      ? t('subscription.getSubscription')
      : t('subscription.extend');
  // Пока пробная работает, главная кнопка экрана — «Подключить устройство» в карточке
  // выше, эта спокойная. Пробная закончилась — действие на экране одно, кнопка залита.
  const trialLive = Boolean(isTrial && (subscription?.is_active || subscription?.is_limited));

  // Legacy (no tariff) → tariff catalog pinned to this subscription
  // Otherwise (trial included: it can't be renewed) → purchase page
  const linkTo =
    requiresTariff && subscription?.id
      ? tariffSelectionPath(subscription.id)
      : '/subscription/purchase';

  return (
    <Link to={linkTo} className={linkButton(trialLive ? 'secondary' : 'primary', 'w-full')}>
      {buttonText}
    </Link>
  );
}
