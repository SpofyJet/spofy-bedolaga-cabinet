import { formatSmartDate } from '@/utils/liteDate';
import { uiLocale } from '@/utils/uiLocale';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  PiArrowsClockwiseBold,
  PiCheckBold,
  PiCopyDuotone,
  PiDevicesDuotone,
  PiDownloadSimpleDuotone,
  PiHourglassDuotone,
  PiLinkDuotone,
  PiSmileySadDuotone,
  PiWarningDuotone,
} from 'react-icons/pi';
import { subscriptionApi } from '../api/subscription';
import { formatTraffic } from '../utils/formatTraffic';
import { copyToClipboard } from '../utils/clipboard';
import { useTheme } from '../hooks/useTheme';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import PurchaseCTAButton from '../components/subscription/PurchaseCTAButton';
import BypassSuspendedBanner from '../components/subscription/BypassSuspendedBanner';
import { planTitle, showsAddonOptions, showsAutopayToggle } from '../utils/legacySubscription';
import { isLifetimeEndDate, isLifetimeSubscription } from '../utils/lifetime';
import { useHaptic } from '../platform';
import { resolveConnectionUrlForUi } from '../utils/connectionLink';
import { AutopayToggle } from '../components/subscription/manage/AutopayToggle';
import { DailyPausePanel } from '../components/subscription/manage/DailyPausePanel';
import {
  canReissueLink,
  ReissueLinkButton,
} from '../components/subscription/manage/ReissueLinkButton';
import { DevicesPanel } from '../components/subscription/manage/DevicesPanel';
import { RecurringPanels } from '../components/subscription/manage/RecurringPanels';
import { DeviceTopupSheet } from '../components/subscription/sheets/DeviceTopupSheet';
import { DeviceReductionSheet } from '../components/subscription/sheets/DeviceReductionSheet';
import { TrafficTopupSheet } from '../components/subscription/sheets/TrafficTopupSheet';
import { DeleteSubscriptionSheet } from '../components/subscription/sheets/DeleteSubscriptionSheet';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Button,
  Chip,
  EmptyState,
  Group,
  Page,
  Row,
  RowIcon,
  SectionTitle,
  Stat,
  Surface,
} from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import { safeLocal } from '../utils/safeStorage';

const formatDate = (iso: string) => formatSmartDate(iso);

/**
 * Группа строк, которая прячется целиком, если ни одна строка не отрисовалась
 * (автоплатёж, автосписания и докупки сами решают, показываться ли).
 */
function OptionalGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="has-[>div:empty]:hidden">
      <SectionTitle>{title}</SectionTitle>
      <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-900/70 empty:hidden">
        {children}
      </div>
    </section>
  );
}

/** Полоса расхода трафика: синяя, пока всё в порядке; жёлтая и красная — на исходе (зелёный — только статус «Активна»). */
function TrafficBar({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, percent));
  const tone = value >= 90 ? 'bg-error-400' : value >= 70 ? 'bg-warning-400' : 'bg-accent-400';
  return (
    <div className="h-2 overflow-hidden rounded-full bg-dark-800">
      <div
        className={cn('h-full origin-left rounded-full transition-transform duration-500', tone)}
        style={{ transform: `scaleX(${value > 0 ? Math.max(value, 2) / 100 : 0})` }}
      />
    </div>
  );
}

export default function Subscription() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { subscriptionId: subIdParam } = useParams<{ subscriptionId?: string }>();
  const subscriptionId = subIdParam ? parseInt(subIdParam, 10) : undefined;
  const { isDark } = useTheme();
  const haptic = useHaptic();
  const [copied, setCopied] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  // Device/traffic topup state
  const [searchParams] = useSearchParams();
  // ?topup=devices («Добавить место» на главной) сразу открывает докупку устройств.
  const [showDeviceTopup, setShowDeviceTopup] = useState(
    () => searchParams.get('topup') === 'devices',
  );
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const [showDeviceReduction, setShowDeviceReduction] = useState(false);
  const [targetDeviceLimit, setTargetDeviceLimit] = useState<number>(1);
  // ?topup=traffic (баннер «обходы отключены» на главной) сразу открывает докупку трафика.
  const [showTrafficTopup, setShowTrafficTopup] = useState(
    () => searchParams.get('topup') === 'traffic',
  );
  const [selectedTrafficPackage, setSelectedTrafficPackage] = useState<number | null>(null);

  // Traffic refresh state
  const [trafficRefreshCooldown, setTrafficRefreshCooldown] = useState(0);

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

  const usedPercent = trafficData?.traffic_used_percent ?? subscription?.traffic_used_percent ?? 0;

  // Purchase options (needed for balance_kopeks in device/traffic/server management)
  const purchaseOptionsQuery = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const purchaseOptions = purchaseOptionsQuery.data;

  // Счётчик подключённых устройств в шапке. Сам список живёт в <DevicesPanel>
  // и ходит по тому же ключу, так что второго запроса не возникает.
  const { data: devicesData } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
    enabled: !!subscription,
  });

  // Auto-close all modals/forms when success notification appears
  const handleCloseAllModals = useCallback(() => {
    setShowDeviceTopup(false);
    setShowDeviceReduction(false);
    setShowTrafficTopup(false);
  }, []);
  useCloseOnSuccessNotification(handleCloseAllModals);

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

  // ?section=devices («Мои устройства»): на экране только устройства и управление ими.
  const openDevices = searchParams.get('section') === 'devices';

  // In multi-tariff mode without a specific subscription ID, redirect to list
  if (isMultiTariff && !subscriptionId && !isLoading) {
    return <Navigate to={`/subscriptions?${searchParams.toString()}`} replace />;
  }

  const backTo = isMultiTariff ? '/subscriptions' : '/';

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
      <Page>
        <PageHeader title={t('subscription.title')} backTo={backTo} />
        <EmptyState
          icon={<PiSmileySadDuotone />}
          title={t('subscription.notFound', 'Подписка не найдена')}
          text={t('subscription.notFoundDesc', 'Возможно, подписка была удалена или не существует')}
          action={
            <Button onClick={() => navigate('/subscriptions')}>
              {t('subscription.backToList', 'Мои подписки')}
            </Button>
          }
        />
      </Page>
    );
  }

  if (!subscription) {
    return (
      <Page>
        <PageHeader title={t('subscription.title')} backTo={backTo} />
        <EmptyState icon={<PiHourglassDuotone />} title={t('subscription.noSubscription')} />
        <PurchaseCTAButton subscription={null} isMultiTariff={isMultiTariff} />
      </Page>
    );
  }

  const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
  const isUnlimited = (trafficData?.is_unlimited ?? false) || subscription.traffic_limit_gb === 0;
  const connectedDevices = devicesData?.total ?? 0;
  const isAtDeviceLimit =
    subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;
  const isLifetime = isLifetimeSubscription(subscription);
  const isLive = subscription.is_active || subscription.is_limited;

  const status = subscription.is_active
    ? subscription.is_trial
      ? { tone: 'accent' as const, label: t('subscription.trialStatus') }
      : { tone: 'success' as const, label: t('subscription.active') }
    : subscription.is_limited
      ? { tone: 'warning' as const, label: t('subscription.trafficLimited') }
      : subscription.status === 'disabled'
        ? { tone: 'warning' as const, label: t('subscription.pause.suspended') }
        : { tone: 'error' as const, label: t('subscription.expired') };

  // Срок: у вечной — «Навсегда» (без даты 2099 и «осталось N дней»), у
  // истёкшей — когда закончилась, у живой — сколько осталось и до какого числа.
  const term =
    isLifetime && isLive
      ? {
          label: t('subscription.lifetime.term'),
          value: `∞ ${t('subscription.lifetime.forever')}`,
          hint: undefined,
        }
      : !isLive
        ? {
            label: t('subscription.v10.ended', 'Закончилась'),
            value: new Date(subscription.end_date).toLocaleDateString(uiLocale(), {
              day: 'numeric',
              month: 'short',
            }),
            hint: undefined,
          }
        : {
            label: t('dashboard.remaining', 'Осталось'),
            value:
              subscription.days_left > 0
                ? t('subscription.days', { count: subscription.days_left })
                : `${subscription.hours_left} ${t('subscription.hours')} ${subscription.minutes_left} ${t('subscription.minutes')}`,
            hint: t('subscription.v10.until', 'до {{date}}', {
              date: formatDate(subscription.end_date),
            }),
          };

  const trafficLabel = subscription.bypass_quota
    ? t('subscription.bypassQuotaLabel')
    : t('subscription.traffic');
  const trafficNotes = [
    subscription.bypass_quota ? t('dashboard.regularUnlimited') : null,
    !isUnlimited &&
    subscription.traffic_reset_mode &&
    subscription.traffic_reset_mode !== 'NO_RESET'
      ? t(`subscription.trafficReset.${subscription.traffic_reset_mode}`)
      : null,
  ].filter(Boolean);

  const purchasedTraffic = subscription.traffic_purchases ?? [];
  const showAddons = showsAddonOptions(subscription);

  const deviceTopup = (
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
  );
  // Уменьшить лимит — редкое действие: тихая ссылка у списка устройств,
  // а не строка среди покупок в «Докупить».
  const devicesFooter = showAddons ? (
    <DeviceReductionSheet
      trigger="link"
      open={showDeviceReduction}
      onOpen={() => setShowDeviceReduction(true)}
      onClose={() => setShowDeviceReduction(false)}
      subscriptionPresent={!!subscription}
      subscriptionId={subscriptionId}
      targetDeviceLimit={targetDeviceLimit}
      onTargetDeviceLimitChange={setTargetDeviceLimit}
      isDark={isDark}
    />
  ) : undefined;

  if (openDevices) {
    return (
      <Page>
        <PageHeader title={t('subscription.myDevices')} backTo={backTo} />
        <DevicesPanel
          subscription={subscription}
          subscriptionId={subscriptionId}
          footer={devicesFooter}
          showCount
        />
        {showAddons && <Group>{deviceTopup}</Group>}
        <Button className="w-full" onClick={() => navigate('/connection')}>
          {t('dashboard.connectDevice')}
        </Button>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title={t('subscription.title')} backTo={backTo} />

      {/* ─── Главное: тариф, статус, срок, устройства, трафик ─── */}
      <Surface>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-dark-400">
              {t('subscription.baseTariff', 'Тариф')}
            </p>
            <h2 className="mt-0.5 truncate font-display text-xl font-bold tracking-tight text-dark-50">
              {planTitle(subscription, t)}
            </h2>
          </div>
          <Chip tone={status.tone}>{status.label}</Chip>
        </div>

        {subscription.is_trial && subscription.is_active && (
          <p className="mt-2 text-[13px] leading-snug text-dark-400">
            {t('subscription.trialInfo.description')}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Stat label={term.label} value={term.value} hint={term.hint} />
          <Stat
            label={t('subscription.devices')}
            value={
              // число устройств живёт в панели и приходит позже подписки — без
              // заглушки сначала мелькало «0 из 5», потом «3 из 5»
              devicesData === undefined ? (
                <Skeleton className="h-[30px] w-20" />
              ) : subscription.device_limit === 0 ? (
                `${connectedDevices} · ∞`
              ) : (
                t('subscription.v10.devicesOf', '{{used}} из {{max}}', {
                  used: connectedDevices,
                  max: subscription.device_limit,
                })
              )
            }
            hint={
              isAtDeviceLimit
                ? t('dashboard.deviceLimitReached')
                : t('subscription.v10.connected', 'подключено')
            }
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-dark-300">{trafficLabel}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tabular-nums text-dark-100">
                {isUnlimited
                  ? formatTraffic(usedGb)
                  : `${formatTraffic(usedGb)} / ${formatTraffic(subscription.traffic_limit_gb)}`}
              </span>
              <button
                type="button"
                onClick={() => refreshTrafficMutation.mutate()}
                disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
                aria-label={t('common.refresh')}
                title={
                  trafficRefreshCooldown > 0
                    ? `${t('common.refresh')} · ${trafficRefreshCooldown}s`
                    : t('common.refresh')
                }
                className="-my-3 -mr-3.5 flex h-11 w-11 items-center justify-center rounded-xl text-dark-200 transition-colors hover:bg-dark-800/70 hover:text-dark-200 disabled:opacity-40"
              >
                <PiArrowsClockwiseBold
                  className={cn('h-4 w-4', refreshTrafficMutation.isPending && 'animate-spin')}
                />
              </button>
            </div>
          </div>
          {isUnlimited ? (
            <p className="text-[13px] leading-snug text-dark-400">
              {[
                t('subscription.v10.trafficUnlimited', 'Без ограничения по объёму'),
                ...trafficNotes,
              ].join(' · ')}
            </p>
          ) : (
            <TrafficBar percent={usedPercent} />
          )}
          {!isUnlimited && trafficNotes.length > 0 && (
            <p className="mt-2 text-[13px] leading-snug text-dark-400">
              {trafficNotes.join(' · ')}
            </p>
          )}
        </div>

        {subscription.subscription_url && isLive && (
          <Button
            className="mt-5 w-full"
            onClick={() => {
              haptic.impact('light');
              navigate(subscriptionId ? `/connection?sub=${subscriptionId}` : '/connection');
            }}
          >
            <PiDevicesDuotone className="h-5 w-5" />
            {t('dashboard.connectDevice')}
          </Button>
        )}
      </Surface>

      {/* ─── Обходы отключены за трафик, обычные серверы работают ─── */}
      {subscription.bypass_suspended && (
        <BypassSuspendedBanner
          isTrial={subscription.is_trial}
          onBuyTraffic={() => setShowTrafficTopup(true)}
          renewTo={
            isLifetime
              ? undefined
              : isMultiTariff
                ? `/subscriptions/${subscription.id}/renew`
                : '/subscription/purchase'
          }
        />
      )}

      {/* ─── Трафик закончился ─── */}
      {subscription.is_limited && (
        <Surface className="flex items-start gap-3 bg-warning-500/5">
          <RowIcon tone="warning">
            <PiWarningDuotone />
          </RowIcon>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-dark-100">
              {t('subscription.trafficLimitedTitle')}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-dark-400">
              {t('subscription.trafficLimitedDescription')}
            </p>
          </div>
        </Surface>
      )}

      {/* ─── Продлить / сменить тариф ─── */}
      <PurchaseCTAButton subscription={subscription} isMultiTariff={isMultiTariff} />

      {/* ─── Ссылка подписки ─── */}
      {((displayedConnectionUrl && !shouldHideConnectionLink) || canReissueLink(subscription)) && (
        <Group title={t('subscription.v10.linkTitle', 'Ссылка подписки')}>
          {displayedConnectionUrl && !shouldHideConnectionLink && (
            <Row
              icon={<PiLinkDuotone />}
              iconTone="account"
              label={
                <span dir="ltr" className="text-[14px] font-medium text-dark-200">
                  {displayedConnectionUrl}
                </span>
              }
              description={copied ? t('subscription.copied') : t('subscription.copyLink')}
              onClick={copyUrl}
              trailing={
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    copied ? 'bg-success-500/10 text-success-400' : 'text-dark-400',
                  )}
                  aria-hidden
                >
                  {copied ? (
                    <PiCheckBold className="h-4 w-4" />
                  ) : (
                    <PiCopyDuotone className="h-5 w-5" />
                  )}
                </span>
              }
            />
          )}
          {canReissueLink(subscription) && (
            <ReissueLinkButton subscription={subscription} subscriptionId={subscriptionId} />
          )}
        </Group>
      )}

      {/* ─── Автоплатёж ─── */}
      {!subscription.is_trial && (
        <OptionalGroup title={t('subscription.v10.paymentTitle', 'Автопродление')}>
          {showsAutopayToggle(subscription) && (
            <AutopayToggle subscription={subscription} subscriptionId={subscriptionId} />
          )}
          <RecurringPanels subscription={subscription} subscriptionId={subscriptionId} />
        </OptionalGroup>
      )}

      {/* ─── Суточный тариф: пауза ─── */}
      {subscription.is_daily && !subscription.is_trial && (
        <Surface>
          <DailyPausePanel subscription={subscription} subscriptionId={subscriptionId} />
        </Surface>
      )}

      {/* ─── Докупки ─── */}
      {showAddons && (
        <Group title={t('subscription.v10.addonsTitle', 'Докупить')}>
          {deviceTopup}
          {subscription.traffic_limit_gb > 0 && (
            <div>
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
        </Group>
      )}

      {/* ─── Докупленный трафик ─── */}
      {purchasedTraffic.length > 0 && (
        <Group title={t('subscription.purchasedTraffic')}>
          {purchasedTraffic.map((purchase) => {
            // Пакет вечной подписки живёт столько же, сколько она: без
            // «26 000 дней», даты 2099 года и полосы времени.
            const forever = isLifetimeEndDate(purchase.expires_at);
            return (
              <Row
                key={purchase.id}
                icon={<PiDownloadSimpleDuotone />}
                iconTone="devices"
                label={`${purchase.traffic_gb} ${t('common.units.gb')}`}
                description={
                  forever
                    ? t('subscription.lifetime.forever')
                    : `${t('subscription.trafficResetAt')}: ${formatDate(purchase.expires_at)}`
                }
                hint={
                  forever
                    ? undefined
                    : purchase.days_remaining === 0
                      ? t('subscription.expired')
                      : t('subscription.days', { count: purchase.days_remaining })
                }
              />
            );
          })}
        </Group>
      )}

      {/* ─── Устройства ─── */}
      <DevicesPanel
        subscription={subscription}
        subscriptionId={subscriptionId}
        footer={devicesFooter}
      />

      {/* ─── Удалить истёкшую (мультитариф) ─── */}
      {isMultiTariff &&
        !subscription.is_active &&
        !subscription.is_trial &&
        !subscription.is_limited && (
          <DeleteSubscriptionSheet
            subscriptionId={subscription.id}
            open={showDeleteSheet}
            onOpen={() => setShowDeleteSheet(true)}
            onClose={() => setShowDeleteSheet(false)}
            textSecondary="rgb(var(--color-dark-400))"
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
              navigate('/subscriptions', { replace: true });
            }}
          />
        )}
    </Page>
  );
}
