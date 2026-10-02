import { uiLocale } from '@/utils/uiLocale';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import ConnectDeviceTile from './ConnectDeviceTile';
import { useTrafficZone } from '../../hooks/useTrafficZone';
import { formatTraffic } from '../../utils/formatTraffic';
import { ChevronRightIcon, RefreshIcon } from '@/components/icons';
import type { Subscription } from '../../types';

interface SubscriptionCardActiveProps {
  subscription: Subscription;
  trafficData: {
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null;
  refreshTrafficMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trafficRefreshCooldown: number;
  connectedDevices: number;
}

/**
 * Карточка активной подписки на главной.
 *
 * Отвечает на три вопроса в порядке важности: работает ли доступ и до какого
 * числа, сколько осталось трафика, как подключить ещё одно устройство. Всё,
 * что не отвечает ни на один из них (декоративные полосы, счётчики секунд,
 * подписи капслоком), убрано.
 */
export default function SubscriptionCardActive({
  subscription,
  trafficData,
  refreshTrafficMutation,
  trafficRefreshCooldown,
  connectedDevices,
}: SubscriptionCardActiveProps) {
  const { t } = useTranslation();

  const usedPercent = trafficData?.traffic_used_percent ?? subscription.traffic_used_percent;
  const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
  const isUnlimited = trafficData?.is_unlimited ?? subscription.traffic_limit_gb === 0;
  const zone = useTrafficZone(usedPercent);

  const endDate = new Date(subscription.end_date).toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const daysLeft = subscription.days_left;
  const isEndingSoon = daysLeft <= 3;
  // Крупный счётчик дней — когда срок и правда главное: пробный период или
  // последняя неделя. На многолетней подписке хватает строки с датой.
  const showBigTerm = subscription.is_trial || daysLeft <= 7;
  const term =
    daysLeft > 0
      ? t('dashboard.untilWithDays', { date: endDate, days: daysLeft })
      : t('dashboard.untilWithHours', {
          date: endDate,
          hours: Math.max(1, subscription.hours_left),
        });

  // Трафик на исходе окрашивает статус так же, как полосу: это информация, а не декор.
  const trafficStressed = !isUnlimited && zone.zone !== 'normal';
  const trafficLeftPercent = Math.max(0, 100 - Math.round(usedPercent));
  const statusTone = isEndingSoon
    ? 'rgb(var(--color-warning-400))'
    : trafficStressed
      ? zone.mainVar
      : subscription.is_trial
        ? 'rgb(var(--color-accent-400))'
        : 'rgb(var(--color-success-400))';
  const statusLabel = [
    subscription.is_trial ? t('subscription.trialStatus') : t('subscription.active'),
    trafficStressed ? t('dashboard.trafficLeftPercent', { percent: trafficLeftPercent }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const termTone = isEndingSoon ? 'rgb(var(--color-warning-400))' : 'rgb(var(--color-dark-50))';

  const refreshDisabled = refreshTrafficMutation.isPending || trafficRefreshCooldown > 0;

  return (
    <section className="bento-card !p-5 sm:!p-6" aria-labelledby="subscription-card-title">
      {/* ─── Срок ─── */}
      <div className="min-w-0">
        <div
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: statusTone }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: statusTone }}
            aria-hidden="true"
          />
          {statusLabel}
        </div>
        {/* Две строки вместо обрезки: «🟡 Компания - 10 устройств» на телефоне
            иначе превращалось в «🟡 Компани…». */}
        <h2
          id="subscription-card-title"
          className="line-clamp-2 min-w-0 break-words text-xl font-bold leading-tight text-dark-50"
        >
          {subscription.tariff_name || t('subscription.currentPlan')}
        </h2>
        {showBigTerm ? (
          <div className="mt-4">
            <div className="text-sm text-dark-400">{t('dashboard.remaining')}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5" style={{ color: termTone }}>
              <span className="text-[34px] font-bold leading-none">
                {daysLeft > 0 ? daysLeft : Math.max(1, subscription.hours_left)}
              </span>
              <span className="text-lg font-semibold">
                {daysLeft > 0
                  ? t('dashboard.daysUnit', { count: daysLeft })
                  : t('subscription.hours')}
              </span>
            </div>
            <div className="mt-1 text-sm text-dark-400">
              {t('dashboard.validUntil', { date: endDate })}
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-dark-400">{term}</p>
        )}
      </div>

      {/* ─── Трафик ─── */}
      <div className="mt-5 rounded-xl px-4 py-3.5" style={{ background: 'var(--spofy-tile-bg)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-dark-200">{t('subscription.traffic')}</span>
              <button
                type="button"
                onClick={() => refreshTrafficMutation.mutate()}
                disabled={refreshDisabled}
                className="-my-1 flex h-7 w-7 items-center justify-center rounded-lg text-dark-500 transition-colors hover:bg-dark-50/[0.06] hover:text-dark-200 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label={t('common.refresh')}
                title={t('common.refresh')}
              >
                <RefreshIcon
                  className={`h-3.5 w-3.5 ${refreshTrafficMutation.isPending ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            {isUnlimited && (
              <div className="text-[13px] text-dark-400">
                {t('dashboard.usedTraffic', { amount: formatTraffic(usedGb) })}
              </div>
            )}
          </div>
          <div
            className="shrink-0 text-right text-[15px] font-semibold"
            style={{ color: trafficStressed ? zone.mainVar : 'rgb(var(--color-dark-50))' }}
          >
            {isUnlimited
              ? t('dashboard.unlimited')
              : t('dashboard.trafficOfTotal', {
                  used: formatTraffic(usedGb),
                  total: formatTraffic(subscription.traffic_limit_gb),
                })}
          </div>
        </div>

        {!isUnlimited && (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full"
            style={{ background: 'rgba(var(--color-dark-50), 0.08)' }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPercent)}
            aria-label={t('subscription.traffic')}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.min(100, Math.max(usedPercent > 0 ? 2 : 0, usedPercent))}%`,
                background: zone.mainVar,
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Подключение ─── */}
      <div className="mt-3">
        <ConnectDeviceTile
          subscription={subscription}
          connectedDevices={connectedDevices}
          usedPercent={usedPercent}
        />
      </div>

      {/* Подписанная ссылка находится легче голой стрелки */}
      <div className="mt-4 flex justify-end">
        <Link
          to={`/subscriptions/${subscription.id}`}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-accent-400 transition-colors hover:text-accent-300"
        >
          {t('dashboard.viewSubscription')}
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
