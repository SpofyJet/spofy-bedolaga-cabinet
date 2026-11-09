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
  /** In multi-tariff mode, link to /subscriptions/:id/renew instead of /subscription/purchase */
  isMultiTariff?: boolean;
}

export default function PurchaseCTAButton({
  subscription,
  isMultiTariff = false,
}: PurchaseCTAButtonProps) {
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

  // Daily tariffs renew automatically — no manual renewal button needed in multi-tariff
  if (isMultiTariff && isDaily && !isExpired) return null;
  if (isLifetime && !isExpired) return null;

  const buttonText = requiresTariff
    ? t('subscription.cta.moveToTariff')
    : isExpired
      ? t('subscription.getSubscription')
      : isTrial
        ? t('subscription.trialUpgrade.title')
        : t('subscription.extend');

  // Legacy (no tariff) → tariff catalog pinned to this subscription
  // Trial → purchase page (buy a real tariff, trial can't be renewed)
  // Multi-tariff active → per-subscription renew page
  // Otherwise → purchase page
  const linkTo =
    requiresTariff && subscription?.id
      ? tariffSelectionPath(subscription.id)
      : isTrial
        ? '/subscription/purchase'
        : isMultiTariff && subscription?.id
          ? `/subscriptions/${subscription.id}/renew`
          : '/subscription/purchase';

  return (
    <Link to={linkTo} className={linkButton(isTrial ? 'secondary' : 'primary', 'w-full')}>
      {buttonText}
    </Link>
  );
}
