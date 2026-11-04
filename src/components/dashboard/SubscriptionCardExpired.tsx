import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { Subscription } from '../../types';
import { subscriptionApi } from '../../api/subscription';
import { useHapticFeedback } from '../../platform/hooks/useHaptic';
import { getInsufficientBalanceError } from '../../utils/subscriptionHelpers';
import { needsTariff, tariffSelectionPath } from '../../utils/legacySubscription';
import { ClockIcon, ExclamationIcon, PlusIcon, SubscriptionIcon } from '@/components/icons';

interface SubscriptionCardExpiredProps {
  subscription: Subscription;
  balanceKopeks?: number;
  balanceRubles?: number;
  className?: string;
}

export default function SubscriptionCardExpired({
  subscription,
  balanceKopeks = 0,
  className,
}: SubscriptionCardExpiredProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const haptic = useHapticFeedback();

  const [isRenewing, setIsRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  // Detect limited (traffic exhausted) state
  const isLimited = subscription.is_limited;

  // Detect daily subscription (disabled or expired)
  const isDaily = subscription.is_daily;
  const isDisabledDaily = subscription.status === 'disabled' && isDaily;

  /*
   * Списывать с баланса прямо из карточки можно только там, где выбирать нечего:
   * суточный тариф стоит один день, а приостановленный просто возобновляется.
   *
   * Обычной подписке период выбирает клиент. Кнопка раньше молча продлевала на
   * 30 дней — то есть решала за него и мимо скидок за длинные периоды (месяц за
   * 600 ₽ против полугода со скидкой). Хуже того, тариф вообще мог не
   * продаваться месяцем: тогда сервер отвечал «период недоступен», и кнопка
   * выглядела сломанной. Теперь она открывает выбор периода текущего тарифа.
   */
  const isInstantRenew = isDisabledDaily || (isDaily && !!subscription.tariff_id);
  // Старая подписка (куплена в классике, тарифа нет): продлевать нечего,
  // единственная кнопка ведёт на витрину тарифов с этой подпиской.
  const requiresTariff = needsTariff(subscription);

  // For daily subs, check if balance covers daily price; otherwise 100 kopeks minimum
  const dailyPrice = subscription.daily_price_kopeks ?? 0;
  const hasBalance = isDaily ? balanceKopeks >= dailyPrice && dailyPrice > 0 : balanceKopeks >= 100;

  const handleQuickRenew = async () => {
    setIsRenewing(true);
    setRenewError(null);
    haptic.buttonPressHeavy();

    try {
      if (isDisabledDaily) {
        // Resume daily subscription via toggle pause endpoint
        await subscriptionApi.togglePause(subscription.id);
      } else if (isDaily && subscription.tariff_id) {
        // Expired daily tariff — purchase for 1 day. Pass subscription.id
        // so the backend resolves the EXACT row instead of doing a
        // (user_id, tariff_id) re-lookup that races with concurrent
        // panel webhooks (would surface as "Тариф уже активен" + refund).
        await subscriptionApi.purchaseTariff(subscription.tariff_id, 1, undefined, subscription.id);
      } else {
        // Сюда кнопка не ведёт: обычной подписке период выбирает клиент. Если
        // условия показа когда-нибудь разъедутся, открываем выбор периода, а не
        // списываем месяц молча.
        navigate(`/subscriptions/${subscription.id}/renew`);
        return;
      }
      haptic.success();
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'subscription',
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
    } catch (err: unknown) {
      haptic.error();
      const insufficientData = getInsufficientBalanceError(err);
      if (insufficientData) {
        setRenewError(t('dashboard.expired.insufficientFunds'));
      } else if (err instanceof AxiosError) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          setRenewError(detail);
        } else {
          setRenewError(t('dashboard.expired.renewError'));
        }
      } else {
        setRenewError(t('dashboard.expired.renewError'));
      }
    } finally {
      setIsRenewing(false);
    }
  };

  const handleTopUp = () => {
    haptic.buttonPress();
    const params = new URLSearchParams();
    params.set('returnTo', location.pathname);
    navigate(`/balance/top-up?${params.toString()}`);
  };

  /*
   * v10: на главной уже есть «Подписка · Закончилась» и быстрые действия
   * «Продлить · Тарифы». Карточка показывается только там, где у неё своё
   * действие: суточный тариф (продлить/возобновить с баланса одним нажатием),
   * исчерпанный трафик (докупить) и старая подписка без тарифа (перейти на
   * тариф). Обычной истёкшей подписке она повторяла бы те же три кнопки.
   */
  if (!isLimited && !isInstantRenew && !requiresTariff) return null;

  const title = isLimited
    ? t('subscription.trafficLimitedTitle')
    : isDisabledDaily
      ? t('dashboard.suspended.title')
      : subscription.is_trial
        ? t('dashboard.expired.trialTitle')
        : t('dashboard.expired.title');

  const primaryCls =
    'flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cta-500 px-5 text-[15px] font-semibold text-on-cta transition-colors hover:bg-cta-600 active:scale-[0.98] disabled:opacity-50';

  return (
    <section
      className={`rounded-3xl bg-dark-900/70 p-4 ring-1 ring-inset ring-dark-800/80 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isLimited ? 'bg-warning-500/10 text-warning-400' : 'bg-error-500/10 text-error-400'
          }`}
        >
          {isLimited ? (
            <ExclamationIcon className="h-[22px] w-[22px]" />
          ) : (
            <ClockIcon className="h-[22px] w-[22px]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-dark-100">{title}</h2>
          {isLimited && (
            <p className="mt-0.5 text-[13px] leading-snug text-dark-400">
              {t('subscription.trafficLimitedDescription')}
            </p>
          )}
        </div>
      </div>

      {renewError && (
        <div
          className="mt-3 rounded-xl bg-error-500/10 p-3 text-center text-sm text-error-400 ring-1 ring-inset ring-error-500/25"
          role="alert"
        >
          {renewError}
        </div>
      )}

      <div className="mt-4">
        {isLimited || requiresTariff ? (
          <Link
            to={
              requiresTariff
                ? tariffSelectionPath(subscription.id)
                : `/subscriptions/${subscription.id}`
            }
            onClick={() => haptic.buttonPress()}
            className={primaryCls}
          >
            {requiresTariff ? (
              <SubscriptionIcon className="h-4 w-4" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
            {requiresTariff ? t('subscription.cta.moveToTariff') : t('subscription.buyTraffic')}
          </Link>
        ) : hasBalance ? (
          <button
            type="button"
            onClick={handleQuickRenew}
            disabled={isRenewing}
            className={primaryCls}
          >
            {isRenewing ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
                aria-hidden="true"
              />
            ) : (
              <SubscriptionIcon className="h-4 w-4" />
            )}
            {isRenewing
              ? t('common.loading')
              : isDisabledDaily
                ? t('dashboard.suspended.resume')
                : t('dashboard.expired.quickRenew')}
          </button>
        ) : (
          <button type="button" onClick={handleTopUp} className={primaryCls}>
            <PlusIcon className="h-4 w-4" />
            {t('dashboard.expired.topUp')}
          </button>
        )}
      </div>
    </section>
  );
}
