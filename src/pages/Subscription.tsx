import { uiLocale } from '@/utils/uiLocale';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { WebBackButton } from '../components/WebBackButton';
import TrafficProgressBar from '../components/dashboard/TrafficProgressBar';
import { useTrafficZone } from '../hooks/useTrafficZone';
import { formatTraffic } from '../utils/formatTraffic';
import { getGlassColors } from '../utils/glassTheme';
import { copyToClipboard } from '../utils/clipboard';
import { useTheme } from '../hooks/useTheme';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import PurchaseCTAButton from '../components/subscription/PurchaseCTAButton';
import { planTitle, showsAddonOptions } from '../utils/legacySubscription';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  RefreshIcon,
  TrashIcon,
  WarningIcon,
} from '../components/icons';
import { resolveConnectionUrlForUi } from '../utils/connectionLink';
import { getFlagEmoji } from '../utils/subscriptionHelpers';
import Twemoji from '@/lib/twemoji';
import { AutopayToggle } from '../components/subscription/manage/AutopayToggle';
import { DailyPausePanel } from '../components/subscription/manage/DailyPausePanel';
import {
  canReissueLink,
  ReissueLinkButton,
} from '../components/subscription/manage/ReissueLinkButton';
import { DevicesPanel } from '../components/subscription/manage/DevicesPanel';
import ConnectDeviceTile from '../components/dashboard/ConnectDeviceTile';
import { RecurringPanels } from '../components/subscription/manage/RecurringPanels';
import { DeviceTopupSheet } from '../components/subscription/sheets/DeviceTopupSheet';
import { DeviceReductionSheet } from '../components/subscription/sheets/DeviceReductionSheet';
import { TrafficTopupSheet } from '../components/subscription/sheets/TrafficTopupSheet';
import { ServerManagementSheet } from '../components/subscription/sheets/ServerManagementSheet';
import { DeleteSubscriptionSheet } from '../components/subscription/sheets/DeleteSubscriptionSheet';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { safeLocal } from '../utils/safeStorage';

/**
 * Срок подписки. Пока впереди больше суток — дни и дата окончания: секундный
 * счётчик на многолетней подписке только нервирует. В последние сутки — живой
 * обратный отсчёт часов и минут (обновление раз в 30 с — своё, не всей страницы).
 */
const CountdownTimer = memo(function CountdownTimer({
  endDate,
  isActive,
}: {
  endDate: string;
  isActive: boolean;
  glassColors?: ReturnType<typeof getGlassColors>;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  const endTime = new Date(endDate).getTime();
  const diff = Math.max(0, endTime - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const isLastDay = isActive && days === 0;

  useEffect(() => {
    if (!isLastDay) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [isLastDay]);

  const isExpired = !isActive;
  const isUrgent = days < 3;
  const tone = isExpired
    ? 'rgb(var(--color-critical-500))'
    : isUrgent
      ? 'rgb(var(--color-urgent-400))'
      : 'rgb(var(--color-dark-50))';

  const formattedDate = new Date(endDate).toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-w-0 rounded-xl px-4 py-3.5" style={{ background: 'var(--spofy-tile-bg)' }}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 shrink-0"
          style={{ color: isExpired || isUrgent ? tone : undefined }}
        >
          <CalendarIcon className="h-5 w-5 text-dark-400" />
        </span>
        <div className="min-w-0 flex-1">
          {isExpired ? (
            <div className="text-[17px] font-bold" style={{ color: tone }}>
              {t('subscription.expired')}
            </div>
          ) : (
            <div className="text-[17px] font-bold" style={{ color: tone }}>
              {isLastDay
                ? `${hours}\u00A0${t('subscription.hours')} ${minutes}\u00A0${t('subscription.minutes')}`
                : `${days}\u00A0${t('subscription.daysShort')}`}
            </div>
          )}
          <div className="mt-0.5 text-[13px] text-dark-400">
            {t('subscription.expiresAt')} {formattedDate}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Subscription() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { subscriptionId: subIdParam } = useParams<{ subscriptionId?: string }>();
  const subscriptionId = subIdParam ? parseInt(subIdParam, 10) : undefined;
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const [copied, setCopied] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  // Device/traffic topup state
  const [showDeviceTopup, setShowDeviceTopup] = useState(false);
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const [showDeviceReduction, setShowDeviceReduction] = useState(false);
  const [targetDeviceLimit, setTargetDeviceLimit] = useState<number>(1);
  const [showTrafficTopup, setShowTrafficTopup] = useState(false);
  const [selectedTrafficPackage, setSelectedTrafficPackage] = useState<number | null>(null);
  const [showServerManagement, setShowServerManagement] = useState(false);
  const [selectedServersToUpdate, setSelectedServersToUpdate] = useState<string[]>([]);

  // Traffic refresh state
  const [trafficRefreshCooldown, setTrafficRefreshCooldown] = useState(0);

  // Revoke (reissue) cooldown state
  const [trafficData, setTrafficData] = useState<{
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null>(null);

  // Detect multi-tariff mode from cached subscriptions-list
  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  const { data: subscriptionResponse, isLoading } = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionApi.getSubscription(subscriptionId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: connectionLink, isLoading: isConnectionLinkLoading } = useQuery({
    queryKey: ['connection-link', subscriptionId],
    queryFn: () => subscriptionApi.getConnectionLink(subscriptionId),
    retry: false,
    staleTime: 0,
  });

  // Extract subscription from response (null if no subscription)
  const subscription = subscriptionResponse?.subscription ?? null;
  const displayedConnectionUrl = useMemo(
    () =>
      resolveConnectionUrlForUi({
        mode: connectionLink?.connect_mode,
        happSchemeLink: connectionLink?.happ_scheme_link,
        displayLink: connectionLink?.display_link,
        subscriptionUrl: connectionLink?.subscription_url,
        happCryptLink: connectionLink?.happ_cryptolink,
        happCryptoLink: connectionLink?.happ_crypto_link,
        happLink: connectionLink?.happ_link,
        fallbackUrl: isConnectionLinkLoading ? null : (subscription?.subscription_url ?? null),
      }),
    [
      connectionLink?.connect_mode,
      connectionLink?.display_link,
      connectionLink?.happ_cryptolink,
      connectionLink?.happ_crypto_link,
      connectionLink?.happ_link,
      connectionLink?.happ_scheme_link,
      connectionLink?.subscription_url,
      isConnectionLinkLoading,
      subscription?.subscription_url,
    ],
  );
  const shouldHideConnectionLink =
    subscription?.hide_subscription_link || connectionLink?.hide_link;

  // Traffic zone (theme-aware) — called unconditionally at top level
  const usedPercent = trafficData?.traffic_used_percent ?? subscription?.traffic_used_percent ?? 0;
  const zone = useTrafficZone(usedPercent);

  // Purchase options (needed for balance_kopeks in device/traffic/server management)
  const purchaseOptionsQuery = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const purchaseOptions = purchaseOptionsQuery.data;

  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';

  // Devices query
  // Счётчик подключённых устройств в шапке. Сам список живёт в <DevicesPanel>
  // и ходит по тому же ключу, так что второго запроса не возникает.
  const { data: devicesData } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
    enabled: !!subscription,
  });

  // Pause subscription mutation
  // Auto-close all modals/forms when success notification appears
  const handleCloseAllModals = useCallback(() => {
    setShowDeviceTopup(false);
    setShowDeviceReduction(false);
    setShowTrafficTopup(false);
    setShowServerManagement(false);
  }, []);
  useCloseOnSuccessNotification(handleCloseAllModals);

  // (device price + purchase moved into <DeviceTopupSheet>)
  // (device reduction info + mutation moved into <DeviceReductionSheet>)

  // (traffic packages + purchase moved into <TrafficTopupSheet>)
  // (countries query + update mutation moved into <ServerManagementSheet>)

  // Traffic refresh mutation
  const refreshTrafficMutation = useMutation({
    mutationFn: () => subscriptionApi.refreshTraffic(subscriptionId),
    onSuccess: (data) => {
      setTrafficData({
        traffic_used_gb: data.traffic_used_gb,
        traffic_used_percent: data.traffic_used_percent,
        is_unlimited: data.is_unlimited,
      });
      safeLocal.setItem(`traffic_refresh_ts_${subscriptionId ?? 'default'}`, Date.now().toString());
      if (data.rate_limited && data.retry_after_seconds) {
        setTrafficRefreshCooldown(data.retry_after_seconds);
      } else {
        setTrafficRefreshCooldown(30);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
    onError: (error: {
      response?: { status?: number; headers?: { get?: (key: string) => string } };
    }) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers?.get?.('Retry-After');
        setTrafficRefreshCooldown(retryAfter ? parseInt(retryAfter, 10) : 30);
      }
    },
  });

  // Track if we've already triggered auto-refresh this session
  const hasAutoRefreshed = useRef(false);

  // Cooldown timer for traffic refresh
  useEffect(() => {
    if (trafficRefreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setTrafficRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [trafficRefreshCooldown]);

  // Auto-refresh traffic on mount (with 30s caching)
  useEffect(() => {
    if (!subscription) return;
    if (hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;

    const lastRefresh = safeLocal.getItem(`traffic_refresh_ts_${subscriptionId ?? 'default'}`);
    const now = Date.now();
    const cacheMs = 30 * 1000;

    if (lastRefresh && now - parseInt(lastRefresh, 10) < cacheMs) {
      const elapsed = now - parseInt(lastRefresh, 10);
      const remaining = Math.ceil((cacheMs - elapsed) / 1000);
      if (remaining > 0) {
        setTrafficRefreshCooldown(remaining);
      }
      return;
    }

    refreshTrafficMutation.mutate();
  }, [subscription, refreshTrafficMutation, subscriptionId]);

  const copyUrl = () => {
    if (displayedConnectionUrl) {
      void copyToClipboard(displayedConnectionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // In multi-tariff mode without a specific subscription ID, redirect to list
  if (isMultiTariff && !subscriptionId && !isLoading) {
    return <Navigate to="/subscriptions" replace />;
  }

  if (isLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-48">
        <Skeleton variant="card" className="h-64" />
        <Skeleton variant="card" count={2} className="h-20" />
      </PageSkeleton>
    );
  }

  if (!subscription && subscriptionId) {
    return (
      <div className="mx-auto max-w-lg p-4 text-center">
        <div className="mb-4 text-4xl">😕</div>
        <h2 className="mb-2 text-xl font-bold text-dark-50">
          {t('subscription.notFound', 'Подписка не найдена')}
        </h2>
        <p className="mb-4 text-sm text-dark-50/60">
          {t('subscription.notFoundDesc', 'Возможно, подписка была удалена или не существует')}
        </p>
        <button
          onClick={() => navigate('/subscriptions')}
          className="rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-medium text-on-accent"
        >
          {t('subscription.backToList', 'Мои подписки')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <WebBackButton to={isMultiTariff ? '/subscriptions' : '/'} />
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
          {isMultiTariff && subscription?.tariff_name
            ? subscription.tariff_name
            : t('subscription.title')}
        </h1>
      </div>

      {/* Current Subscription */}
      {subscription ? (
        (() => {
          const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
          const isUnlimited =
            (trafficData?.is_unlimited ?? false) || subscription.traffic_limit_gb === 0;
          const connectedDevices = devicesData?.total ?? 0;

          return (
            <div className="bento-card !p-5 sm:!p-6">
              {/* Decorative ambient radial + trial shimmer border were
                  removed: they carried no information, leaked zone/accent
                  hue into pure decoration (violates DESIGN.md
                  Tunable-but-Scarce + Status-Hue Lockout rules), and the
                  same chrome was distilled out of SubscriptionCardActive
                  earlier in this branch. Trial state is conveyed by the
                  header badge. */}

              {/* ─── Header ─── */}
              {(() => {
                const statusColor = subscription.is_active
                  ? subscription.is_trial
                    ? 'rgb(var(--color-accent-400))'
                    : 'rgb(var(--color-success-400))'
                  : subscription.is_limited
                    ? 'rgb(var(--color-urgent-400))'
                    : 'rgb(var(--color-critical-500))';
                const statusLabel = subscription.is_active
                  ? subscription.is_trial
                    ? t('subscription.trialStatus')
                    : t('subscription.active')
                  : subscription.is_limited
                    ? t('subscription.trafficLimited')
                    : subscription.status === 'disabled'
                      ? t('subscription.pause.suspended')
                      : t('subscription.expired');
                return (
                  <div className="mb-5 min-w-0">
                    <div
                      className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: statusColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: statusColor }}
                        aria-hidden="true"
                      />
                      {statusLabel}
                    </div>
                    <h2 className="line-clamp-2 break-words text-xl font-bold leading-tight text-dark-50">
                      {planTitle(subscription, t)}
                    </h2>
                  </div>
                );
              })()}

              {/* ─── Traffic Limited Banner ─── */}
              {subscription.is_limited && (
                <div
                  className="mb-6 rounded-[14px] p-4"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.03))',
                    border: '1px solid rgba(255,184,0,0.2)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'rgba(255,184,0,0.12)' }}
                    >
                      <WarningIcon className="h-4 w-4 text-urgent-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: 'rgb(var(--color-urgent-400))' }}
                      >
                        {t('subscription.trafficLimitedTitle')}
                      </p>
                      <p className="mt-1 text-xs text-dark-400">
                        {t('subscription.trafficLimitedDescription')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Trial Info Banner ─── */}
              {subscription.is_trial && subscription.is_active && (
                <div
                  className="mb-6 rounded-[14px] p-4"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(var(--color-accent-400), 0.08), rgba(var(--color-accent-400), 0.03))',
                    border: '1px solid rgba(var(--color-accent-400), 0.12)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: 'rgba(var(--color-accent-400), 0.12)' }}
                    >
                      <ClockIcon className="h-4 w-4 text-accent-400" />
                    </div>
                    <div className="flex-1">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: 'rgb(var(--color-accent-400))' }}
                      >
                        {t('subscription.trialInfo.title')}
                      </div>
                      <div className="mt-1 text-[12px] text-dark-400">
                        {t('subscription.trialInfo.description')}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(var(--color-accent-400))' }}
                          >
                            {subscription.days_left > 0
                              ? t('subscription.days', { count: subscription.days_left })
                              : `${subscription.hours_left}${t('subscription.hours')} ${subscription.minutes_left}${t('subscription.minutes')}`}
                          </span>
                          <span className="text-[11px] text-dark-400">
                            {t('subscription.trialInfo.remaining')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(var(--color-accent-400))' }}
                          >
                            {subscription.traffic_limit_gb || '∞'} {t('common.units.gb')}
                          </span>
                          <span className="text-[11px] text-dark-400">
                            {t('subscription.traffic')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: 'rgb(var(--color-accent-400))' }}
                          >
                            {subscription.device_limit === 0 ? '∞' : subscription.device_limit}
                          </span>
                          {/* Слово по числу: было «1 Устройства». Безлимит — «∞ устройств». */}
                          <span className="text-[11px] text-dark-400">
                            {t('subscription.devicesWord', {
                              count:
                                subscription.device_limit === 0 ? 5 : subscription.device_limit,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Traffic ─── */}
              <div
                className="mb-3 rounded-xl px-4 py-3.5"
                style={{ background: 'var(--spofy-tile-bg)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-dark-200">
                        {t('subscription.traffic')}
                      </span>
                      <button
                        type="button"
                        onClick={() => refreshTrafficMutation.mutate()}
                        disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
                        className="-my-1 flex h-7 w-7 items-center justify-center rounded-lg text-dark-500 transition-colors hover:bg-dark-50/[0.06] hover:text-dark-200 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                        aria-label={t('common.refresh')}
                        title={t('common.refresh')}
                      >
                        <RefreshIcon
                          className="h-3.5 w-3.5"
                          spinning={refreshTrafficMutation.isPending}
                        />
                      </button>
                    </div>
                    <div className="text-[13px] text-dark-400">
                      {isUnlimited
                        ? t('dashboard.usedTraffic', { amount: formatTraffic(usedGb) })
                        : subscription.traffic_reset_mode &&
                            subscription.traffic_reset_mode !== 'NO_RESET'
                          ? t(`subscription.trafficReset.${subscription.traffic_reset_mode}`)
                          : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[15px] font-semibold text-dark-50">
                    {isUnlimited
                      ? t('dashboard.unlimited')
                      : t('dashboard.trafficOfTotal', {
                          used: formatTraffic(usedGb),
                          total: formatTraffic(subscription.traffic_limit_gb),
                        })}
                  </div>
                </div>
                {!isUnlimited && (
                  <div className="mt-3">
                    <TrafficProgressBar
                      usedGb={usedGb}
                      limitGb={subscription.traffic_limit_gb}
                      percent={usedPercent}
                      isUnlimited={false}
                      compact
                    />
                  </div>
                )}
              </div>

              {/* ─── Connect Device ─── */}
              <div className="mb-5">
                <ConnectDeviceTile
                  subscription={subscription}
                  connectedDevices={connectedDevices}
                />
              </div>

              {/* ─── Subscription URL ─── */}
              {displayedConnectionUrl && !shouldHideConnectionLink && (
                <div className="mb-5 flex gap-2">
                  <code
                    className="block min-w-0 flex-1 truncate whitespace-nowrap rounded-[10px] px-3 py-2 font-mono text-[11px] text-dark-400"
                    style={{
                      background: g.codeBg,
                      border: `1px solid ${g.codeBorder}`,
                    }}
                    title={displayedConnectionUrl}
                  >
                    {displayedConnectionUrl}
                  </code>
                  <button
                    onClick={copyUrl}
                    className="flex h-auto items-center rounded-[10px] px-3 transition-colors duration-300"
                    style={{
                      background: copied ? 'rgba(var(--color-accent-400), 0.12)' : g.innerBorder,
                      border: copied
                        ? '1px solid rgba(var(--color-accent-400), 0.2)'
                        : `1px solid ${g.trackBg}`,
                      color: copied ? 'rgb(var(--color-accent-400))' : g.textMuted,
                    }}
                    aria-label={t('subscription.copyLink')}
                    title={t('subscription.copyLink')}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              )}

              {/* ─── Countdown ─── */}
              <div className="mb-5">
                <CountdownTimer
                  endDate={subscription.end_date}
                  isActive={subscription.is_active || subscription.is_limited}
                  glassColors={g}
                />
              </div>

              {/* ─── Locations ─── */}
              {subscription.servers && subscription.servers.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-[13px] font-medium text-dark-400">
                    {t('subscription.locationsLabel')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subscription.servers.map((server) => (
                      <span
                        key={server.uuid}
                        className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11px] font-medium text-dark-50/50"
                        style={{
                          background: g.innerBorder,
                          border: `1px solid ${g.trackBg}`,
                        }}
                      >
                        {server.country_code && (
                          <span className="text-xs">{getFlagEmoji(server.country_code)}</span>
                        )}
                        <Twemoji
                          tag="span"
                          options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}
                        >
                          {server.name}
                        </Twemoji>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Purchased Traffic Packages ─── */}
              {subscription.traffic_purchases && subscription.traffic_purchases.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-[13px] font-medium text-dark-400">
                    {t('subscription.purchasedTraffic')}
                  </div>
                  <div className="space-y-2">
                    {subscription.traffic_purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="rounded-[12px] p-3"
                        style={{
                          background: g.innerBg,
                          border: `1px solid ${g.innerBorder}`,
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                              style={{ background: `${zone.mainHex}12`, color: zone.mainHex }}
                            >
                              <DownloadIcon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-semibold text-dark-50">
                              {purchase.traffic_gb} {t('common.units.gb')}
                            </span>
                          </div>
                          <div className="text-right">
                            <div
                              className="text-[11px] font-medium"
                              style={{
                                color: purchase.days_remaining === 0 ? '#FF6B35' : g.textSecondary,
                              }}
                            >
                              {purchase.days_remaining === 0
                                ? t('subscription.expired')
                                : t('subscription.days', { count: purchase.days_remaining })}
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] text-dark-400">
                              {t('subscription.trafficResetAt')}:{' '}
                              {new Date(purchase.expires_at).toLocaleDateString(uiLocale(), {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                        <div
                          className="relative h-1.5 overflow-hidden rounded-full"
                          style={{ background: g.trackBg }}
                        >
                          <div
                            className="absolute inset-0 origin-left rounded-full bg-accent-500 transition-transform duration-500"
                            style={{
                              transform: `scaleX(${purchase.progress_percent / 100})`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between font-mono text-[9px] text-dark-400">
                          <span>
                            {new Date(purchase.created_at).toLocaleDateString(uiLocale())}
                          </span>
                          <span>
                            {new Date(purchase.expires_at).toLocaleDateString(uiLocale())}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Autopay Toggle ─── */}
              <AutopayToggle
                subscription={subscription}
                subscriptionId={subscriptionId}
                accentColor={zone.mainHex}
                offColor={g.textGhost}
                surface={{ background: g.innerBg, border: g.innerBorder }}
              />

              <RecurringPanels subscription={subscription} subscriptionId={subscriptionId} />
            </div>
          );
        })()
      ) : (
        <div
          className="relative overflow-hidden rounded-3xl py-12 text-center"
          style={{
            background: g.cardBg,
            border: `1px solid ${g.cardBorder}`,
            boxShadow: g.shadow,
          }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: g.hoverBg, color: g.textFaint }}
          >
            <TrashIcon className="h-8 w-8" />
          </div>
          <div className="text-sm text-dark-400">{t('subscription.noSubscription')}</div>
        </div>
      )}

      {/* Daily Subscription Pause */}
      {subscription && subscription.is_daily && !subscription.is_trial && (
        <div className="bento-card !p-5 sm:!p-6">
          <DailyPausePanel subscription={subscription} subscriptionId={subscriptionId} />
        </div>
      )}

      {/* Purchase / Renewal CTA */}
      <PurchaseCTAButton subscription={subscription} isMultiTariff={isMultiTariff} />

      {/* Delete expired subscription */}
      {isMultiTariff &&
        subscription &&
        !subscription.is_active &&
        !subscription.is_trial &&
        !subscription.is_limited && (
          <div className="space-y-3">
            <DeleteSubscriptionSheet
              subscriptionId={subscription.id}
              open={showDeleteSheet}
              onOpen={() => setShowDeleteSheet(true)}
              onClose={() => setShowDeleteSheet(false)}
              textSecondary={g.textSecondary}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
                navigate('/subscriptions', { replace: true });
              }}
            />
          </div>
        )}

      {/* Additional Options (Buy Devices) */}
      {subscription && showsAddonOptions(subscription) && (
        <div className="bento-card !p-5 sm:!p-6">
          <h2 className="mb-3 text-base font-bold text-dark-50">
            {t('subscription.additionalOptions.title')}
          </h2>

          {/* Buy Devices */}
          <DeviceTopupSheet
            open={showDeviceTopup}
            onOpen={() => setShowDeviceTopup(true)}
            onClose={() => setShowDeviceTopup(false)}
            subscription={subscription}
            subscriptionId={subscriptionId}
            devicesToAdd={devicesToAdd}
            onDevicesToAddChange={setDevicesToAdd}
            purchaseOptions={purchaseOptions}
            isDark={isDark}
          />

          {/* Reduce Devices */}
          <div className="mt-2">
            <DeviceReductionSheet
              open={showDeviceReduction}
              onOpen={() => setShowDeviceReduction(true)}
              onClose={() => setShowDeviceReduction(false)}
              subscriptionPresent={!!subscription}
              subscriptionId={subscriptionId}
              targetDeviceLimit={targetDeviceLimit}
              onTargetDeviceLimitChange={setTargetDeviceLimit}
              isDark={isDark}
            />
          </div>

          {/* Buy Traffic */}
          {subscription.traffic_limit_gb > 0 && (
            <div className="mt-2">
              <TrafficTopupSheet
                open={showTrafficTopup}
                onOpen={() => setShowTrafficTopup(true)}
                onClose={() => setShowTrafficTopup(false)}
                subscription={subscription}
                subscriptionId={subscriptionId}
                selectedTrafficPackage={selectedTrafficPackage}
                onSelectedTrafficPackageChange={setSelectedTrafficPackage}
                purchaseOptions={purchaseOptions}
                isDark={isDark}
              />
            </div>
          )}

          {/* Server Management - only in classic mode */}
          {!isTariffsMode && (
            <div className="mt-2">
              <ServerManagementSheet
                open={showServerManagement}
                onOpen={() => setShowServerManagement(true)}
                onClose={() => setShowServerManagement(false)}
                subscription={subscription}
                subscriptionId={subscriptionId}
                selectedServers={selectedServersToUpdate}
                onSelectedServersChange={setSelectedServersToUpdate}
                purchaseOptions={purchaseOptions}
                isDark={isDark}
              />
            </div>
          )}

          {/* Перевыпуск ссылки — обычное действие обслуживания, в общем списке */}
          {canReissueLink(subscription) && (
            <div className="mt-2">
              <ReissueLinkButton subscription={subscription} subscriptionId={subscriptionId} />
            </div>
          )}
        </div>
      )}

      {/* Reissue Subscription — standalone block, not dependent on device_limit */}
      {subscription && canReissueLink(subscription) && !showsAddonOptions(subscription) && (
        <div className="bento-card !p-4">
          <ReissueLinkButton subscription={subscription} subscriptionId={subscriptionId} />
        </div>
      )}

      {/* My Devices Section */}
      {subscription && (
        <div className="bento-card !p-5 sm:!p-6">
          <DevicesPanel subscription={subscription} subscriptionId={subscriptionId} />
        </div>
      )}
    </div>
  );
}
