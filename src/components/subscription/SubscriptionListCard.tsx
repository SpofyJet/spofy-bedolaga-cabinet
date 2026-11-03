import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { useHaptic } from '../../platform';
import {
  PiCalendarDuotone,
  PiCaretRightBold,
  PiCheckBold,
  PiDevicesDuotone,
  PiInfinityDuotone,
  PiXBold,
} from 'react-icons/pi';
import { Chip } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import type { SubscriptionListItem } from '../../types';
import { needsTariff, tariffSelectionPath } from '@/utils/legacySubscription';
import { isLifetimeSubscription } from '@/utils/lifetime';
import { connectFooterState } from './connectFooterState';
import { SubscriptionConnectFooter } from './SubscriptionConnectFooter';

function formatDate(iso: string | null, locale?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale ?? undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function SubscriptionListCard({
  subscription,
  onClick,
  connect,
}: {
  subscription: SubscriptionListItem;
  onClick: () => void;
  /**
   * Подключение устройства прямо из карточки. Задаётся только на главной:
   * список «Все подписки» остаётся простым перечнем без действий.
   */
  connect?: {
    /** `undefined`, пока число устройств не загрузилось. */
    connectedDevices: number | undefined;
    onConnect: () => void;
    onManage: () => void;
  };
}) {
  const { t, i18n } = useTranslation();
  const { impact } = useHaptic();

  const handleClick = () => {
    impact('light');
    onClick();
  };

  const isTrial = subscription.is_trial;
  const isLifetime = isLifetimeSubscription(subscription);
  const isActive =
    subscription.status === 'active' ||
    subscription.status === 'trial' ||
    subscription.status === 'limited';
  const isLimitedStatus = subscription.status === 'limited';
  const isExpired = subscription.status === 'expired' || subscription.status === 'disabled';
  const trafficLimit = subscription.traffic_limit_gb;
  const trafficUsed = subscription.traffic_used_gb;
  const isUnlimited = trafficLimit === 0;
  const trafficPercent = isUnlimited
    ? 0
    : trafficLimit > 0
      ? Math.min(100, (trafficUsed / trafficLimit) * 100)
      : 0;
  const trafficColor =
    trafficPercent >= 90
      ? 'bg-error-400'
      : trafficPercent >= 70
        ? 'bg-warning-400'
        : 'bg-accent-500';

  const status = isTrial
    ? { tone: 'accent' as const, label: t('subscription.statusTrial', 'Тестовая') }
    : isLimitedStatus
      ? { tone: 'warning' as const, label: t('subscription.statusLimited', 'Ограничена') }
      : isActive
        ? { tone: 'success' as const, label: t('subscription.statusActive', 'Активна') }
        : isExpired
          ? { tone: 'error' as const, label: t('subscription.statusExpired', 'Истекла') }
          : { tone: 'muted' as const, label: subscription.status };

  const footer = connect
    ? connectFooterState({
        status: subscription.status,
        subscriptionUrl: subscription.subscription_url,
        deviceLimit: subscription.device_limit,
        connected: connect.connectedDevices,
      })
    : { kind: 'hidden' as const };

  const facts: ReactNode[] = [];
  if (footer.kind === 'hidden') {
    facts.push(
      <span key="dev" className="flex items-center gap-1">
        <PiDevicesDuotone className="h-4 w-4 text-dark-500" />
        {subscription.device_limit === 0 ? '∞' : subscription.device_limit}
      </span>,
    );
  }
  facts.push(
    isLifetime ? (
      <span key="term" className="flex items-center gap-1">
        <PiInfinityDuotone className="h-4 w-4 text-dark-500" />
        {t('subscription.lifetime.forever')}
      </span>
    ) : (
      <span key="term" className="flex items-center gap-1">
        <PiCalendarDuotone className="h-4 w-4 text-dark-500" />
        {formatDate(subscription.end_date, i18n.language)}
      </span>
    ),
  );
  // Старая подписка (куплена в классике, тарифа нет): автоплатёж ей
  // недоступен — статус не показываем, кнопка перехода ниже.
  // Вечной подписке продлевать нечего — автопродления тоже нет.
  if (!needsTariff(subscription) && !isTrial && !isLifetime) {
    const isDaily = subscription.is_daily;
    const enabled = isDaily ? !subscription.is_daily_paused : subscription.autopay_enabled;
    const label = isDaily
      ? t('subscription.dailyAutoCharge', 'Автосписание')
      : t('subscription.autopay', 'Автопродление');
    facts.push(
      <span
        key="autopay"
        className={cn('flex items-center gap-1', enabled ? 'text-success-400' : 'text-dark-500')}
      >
        {enabled ? <PiCheckBold className="h-3 w-3" /> : <PiXBold className="h-3 w-3" />}
        {label}
      </span>,
    );
  }

  // Подвал — своя зона нажатия, поэтому карточка снаружи не `<button>`:
  // вложенные кнопки невалидны и ведут себя в браузерах непредсказуемо.
  return (
    <div className="overflow-hidden rounded-3xl bg-dark-900/70 ring-1 ring-inset ring-dark-800/80">
      <button
        type="button"
        onClick={handleClick}
        className="w-full p-4 text-left transition-colors hover:bg-dark-800/30 active:bg-dark-800/50 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[17px] font-bold tracking-tight text-dark-50">
            {subscription.tariff_name || t('subscription.defaultName', 'Подписка')}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Chip tone={status.tone}>{status.label}</Chip>
            <PiCaretRightBold className="h-3.5 w-3.5 text-dark-500" aria-hidden />
          </span>
        </div>

        {isActive && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between text-[13px] text-dark-400">
              <span>{t('subscription.traffic', 'Трафик')}</span>
              <span className="tabular-nums text-dark-300">
                {isUnlimited
                  ? '∞'
                  : `${trafficUsed.toFixed(1)} / ${trafficLimit} ${t('common.units.gb', 'ГБ')}`}
              </span>
            </div>
            {!isUnlimited && (
              <div className="h-1.5 overflow-hidden rounded-full bg-dark-800">
                <div
                  className={`h-full rounded-full transition-all ${trafficColor}`}
                  style={{ width: `${Math.max(1, trafficPercent)}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-dark-400">
          {facts}
        </div>
      </button>

      {needsTariff(subscription) && (
        // Старая подписка: единственный путь — витрина тарифов с этой подпиской.
        // Настоящая кнопка, а не подпись внутри карточки: вся карточка ведёт на
        // страницу подписки, а эта кнопка — сразу на выбор тарифа.
        <Link
          to={tariffSelectionPath(subscription.id)}
          onClick={() => impact('light')}
          className="mx-4 mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent-500 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-600"
        >
          {t('subscription.cta.moveToTariff')}
          <PiCaretRightBold className="h-3.5 w-3.5" />
        </Link>
      )}

      <SubscriptionConnectFooter
        state={footer}
        borderColor="rgba(var(--color-dark-800), 0.7)"
        mutedColor="rgb(var(--color-dark-400))"
        onConnect={() => connect?.onConnect()}
        onManage={() => connect?.onManage()}
      />
    </div>
  );
}
