import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import InsufficientBalancePrompt from '@/components/InsufficientBalancePrompt';
import { PiPauseDuotone } from 'react-icons/pi';
import { useCurrency } from '@/hooks/useCurrency';
import type { Subscription } from '@/types';
import { getErrorMessage, getInsufficientBalanceError } from '@/utils/subscriptionHelpers';
import { uiLocale } from '@/utils/uiLocale';

export interface DailyPausePanelProps {
  subscription: Subscription;
  subscriptionId: number | undefined;
}

/**
 * Пауза посуточной подписки: остановить и возобновить ежедневное списание.
 *
 * Вынесена из тела страницы подписки, чтобы тем же блоком пользовался простой
 * вид. Компонент рисует только содержимое — подложку (карточку или её
 * отсутствие) выбирает экран, который его показывает.
 *
 * Возвращает null там, где паузы не бывает: у непосуточных и у пробных.
 */
export function DailyPausePanel({ subscription, subscriptionId }: DailyPausePanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { formatAmount, currencySymbol } = useCurrency();

  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100)}\u00A0${currencySymbol}`;

  const isSuspended = ['expired', 'disabled', 'limited'].includes(subscription.status);
  const needsResume = subscription.is_daily_paused || isSuspended;

  const pauseMutation = useMutation({
    retry: false,
    mutationFn: () => subscriptionApi.togglePause(subscriptionId, !needsResume),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options', subscriptionId] });
    },
  });

  if (!subscription.is_daily || subscription.is_trial) return null;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-dark-100">
            {t('subscription.pause.title')}
          </h2>
          <div className="mt-0.5 text-[13px] text-dark-400">
            {subscription.is_limited
              ? t('subscription.trafficLimited')
              : subscription.status === 'expired'
                ? t('subscription.statusExpired')
                : isSuspended
                  ? t('subscription.pause.suspended')
                  : subscription.is_daily_paused
                    ? t('subscription.pause.paused')
                    : t('subscription.pause.active')}
          </div>
        </div>
        <button
          onClick={() => pauseMutation.mutate()}
          disabled={pauseMutation.isPending}
          className={
            needsResume
              ? 'inline-flex h-10 shrink-0 items-center rounded-2xl bg-cta-500 px-4 text-sm font-semibold text-on-cta disabled:opacity-60'
              : 'inline-flex h-10 shrink-0 items-center rounded-2xl bg-dark-800/70 px-4 text-sm font-semibold text-dark-100 ring-1 ring-inset ring-dark-700/60 disabled:opacity-60'
          }
        >
          {pauseMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </span>
          ) : needsResume ? (
            t('subscription.pause.resumeBtn')
          ) : (
            t('subscription.pause.pauseBtn')
          )}
        </button>
      </div>

      {/* Pause mutation error */}
      {pauseMutation.isError &&
        (() => {
          const balanceError = getInsufficientBalanceError(pauseMutation.error);
          if (balanceError) {
            const missingAmount = balanceError.required - balanceError.balance;
            return (
              <div className="mt-4">
                <InsufficientBalancePrompt
                  missingAmountKopeks={missingAmount}
                  message={t('subscription.pause.insufficientBalance')}
                  compact
                />
              </div>
            );
          }
          return (
            <div className="mt-4 rounded-2xl bg-error-500/10 p-3 text-center text-[13px] text-error-400">
              {getErrorMessage(pauseMutation.error)}
            </div>
          );
        })()}

      {/* Paused info or Next charge progress bar */}
      {subscription.is_daily_paused ? (
        <div className="mt-4 rounded-2xl bg-warning-500/10 p-4">
          <div className="flex items-start gap-3">
            <PiPauseDuotone className="h-5 w-5 shrink-0 text-warning-400" />
            <div>
              <div className="text-sm font-semibold text-warning-400">
                {t('subscription.pause.pausedInfo')}
              </div>
              <div className="mt-1 text-[12px] text-dark-400">
                {t('subscription.pause.pausedDescription')}{' '}
                {new Date(subscription.end_date).toLocaleDateString(uiLocale())} (
                {t('subscription.pause.days', { count: subscription.days_left })})
              </div>
            </div>
          </div>
        </div>
      ) : (
        !isSuspended &&
        subscription.next_daily_charge_at &&
        (() => {
          const now = new Date();
          const nextChargeStr = subscription.next_daily_charge_at.endsWith('Z')
            ? subscription.next_daily_charge_at
            : `${subscription.next_daily_charge_at}Z`;
          const nextCharge = new Date(nextChargeStr);
          const totalMs = 24 * 60 * 60 * 1000;
          const remainingMs = Math.max(0, nextCharge.getTime() - now.getTime());
          const elapsedMs = totalMs - remainingMs;
          const progress = Math.min(100, (elapsedMs / totalMs) * 100);

          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

          return (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-dark-400">
                  {t('subscription.pause.nextCharge')}
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-dark-50">
                  {hours > 0
                    ? `${hours}${t('subscription.pause.hours')} ${minutes}${t('subscription.pause.minutes')}`
                    : `${minutes}${t('subscription.pause.minutes')}`}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-dark-800">
                <div
                  className="absolute inset-0 origin-left rounded-full transition-transform duration-500"
                  style={{
                    transform: `scaleX(${progress / 100})`,
                    background: 'rgb(var(--color-accent-500))',
                  }}
                />
              </div>
              {subscription.daily_price_kopeks && (
                <div className="mt-2 text-center text-[13px] text-dark-400">
                  {t('subscription.pause.willBeCharged')}:{' '}
                  {formatPrice(subscription.daily_price_kopeks)}
                </div>
              )}
            </div>
          );
        })()
      )}
    </>
  );
}

export default DailyPausePanel;
