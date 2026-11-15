import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { displayName } from '../utils/displayName';
import { subscriptionApi } from '../api/subscription';
import { authApi } from '../api/auth';
import { referralApi } from '../api/referral';
import { balanceApi } from '../api/balance';
import { wheelApi } from '../api/wheel';
import PromoOffersSection from '../components/PromoOffersSection';
import DevicesTrafficCard from '../components/dashboard/DevicesTrafficCard';
import SubscriptionCardExpired from '../components/dashboard/SubscriptionCardExpired';
import { needsTariff } from '../utils/legacySubscription';
import { isLifetimeSubscription } from '../utils/lifetime';
import TrialOfferCard from '../components/dashboard/TrialOfferCard';
import ReminderCards from '../components/dashboard/ReminderCards';
import { giftApi } from '../api/gift';
import PendingGiftCard from '../components/dashboard/PendingGiftCard';
import { Button, Surface } from '@/components/spofy/ui';
import QuickActions from '../components/dashboard/QuickActions';
import InfoCards from '../components/dashboard/InfoCards';
import StatusCard from '../components/dashboard/StatusCard';
import UsefulGrid from '../components/dashboard/UsefulGrid';
import { StoryRail } from '../components/stories';
import { useBranding } from '../hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { API } from '../config/constants';
import { ChevronRightIcon, GiftIcon } from '@/components/icons';
import { WheelIcon } from '@/components/layout/AppShell/icons';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { safeLocal } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/api-error';
import { formatPriceShort } from '../utils/format';
import { plainTariffName } from '@/utils/plainTariffName';

export default function Dashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const queryClient = useQueryClient();
  const [trialError, setTrialError] = useState<string | null>(null);

  // Refresh user data on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Fetch balance from API
  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  // Список подписок: по нему видно, есть ли живой доступ (hasActiveAccess).
  const {
    data: subsList,
    isPending: subsListPending,
    isError: subsListError,
    errorUpdatedAt: subsListErrorAt,
    refetch: refetchSubsList,
  } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });

  const {
    data: subscriptionResponse,
    isLoading: subLoading,
    isError: subError,
    errorUpdatedAt: subErrorAt,
    refetch: refetchSub,
  } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  const subscription = subscriptionResponse?.subscription ?? null;

  const { data: trialInfo, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: !subscription && !subLoading,
  });

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
    enabled: !!subscription,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  // Страница подписки (/subscriptions/:id) читает устройства по ключу
  // ['devices', id]. Этот запрос греет её кэш: переход туда с главной не стоит
  // сети, и счётчик устройств там не мигает «0 → N».
  const listSubId = subsList?.subscriptions?.[0]?.id;
  useQuery({
    queryKey: ['devices', listSubId],
    queryFn: () => subscriptionApi.getDevices(listSubId),
    enabled: listSubId != null,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  const { data: wheelConfig } = useQuery({
    queryKey: ['wheel-config'],
    queryFn: wheelApi.getConfig,
    staleTime: 60000,
    retry: false,
  });

  const { data: pendingGifts } = useQuery({
    queryKey: ['pending-gifts'],
    queryFn: giftApi.getPendingGifts,
    staleTime: 30_000,
    retry: false,
  });

  const activateTrialMutation = useMutation({
    mutationFn: () => subscriptionApi.activateTrial(),
    onSuccess: () => {
      setTrialError(null);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['trial-info'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      refreshUser();
    },
    onError: (error: unknown) => {
      setTrialError(getApiErrorMessage(error, t('common.error')));
    },
  });

  // Traffic refresh state and mutation
  const [trafficRefreshCooldown, setTrafficRefreshCooldown] = useState(0);
  const [trafficData, setTrafficData] = useState<{
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null>(null);

  const refreshTrafficMutation = useMutation({
    mutationFn: () => subscriptionApi.refreshTraffic(subscription?.id),
    onSuccess: (data) => {
      setTrafficData({
        traffic_used_gb: data.traffic_used_gb,
        traffic_used_percent: data.traffic_used_percent,
        is_unlimited: data.is_unlimited,
      });
      safeLocal.setItem(
        `traffic_refresh_ts_${subscription?.id ?? 'default'}`,
        Date.now().toString(),
      );
      if (data.rate_limited && data.retry_after_seconds) {
        setTrafficRefreshCooldown(data.retry_after_seconds);
      } else {
        setTrafficRefreshCooldown(30);
      }
      queryClient.invalidateQueries({
        queryKey: ['subscription', subscription?.id],
      });
    },
    onError: (error: {
      response?: {
        status?: number;
        headers?: { get?: (key: string) => string };
      };
    }) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers?.get?.('Retry-After');
        setTrafficRefreshCooldown(retryAfter ? parseInt(retryAfter, 10) : 30);
      }
    },
  });

  // Cooldown timer
  useEffect(() => {
    if (trafficRefreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setTrafficRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [trafficRefreshCooldown]);

  // Auto-refresh traffic on mount (with 30s caching)
  const hasAutoRefreshed = useRef(false);

  useEffect(() => {
    if (!subscription) return;
    if (hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;

    const lastRefresh = safeLocal.getItem(`traffic_refresh_ts_${subscription?.id ?? 'default'}`);
    const now = Date.now();
    const cacheMs = API.TRAFFIC_CACHE_MS;

    if (lastRefresh && now - parseInt(lastRefresh, 10) < cacheMs) {
      const elapsed = now - parseInt(lastRefresh, 10);
      const remaining = Math.ceil((cacheMs - elapsed) / 1000);
      if (remaining > 0) {
        setTrafficRefreshCooldown(remaining);
      }
      return;
    }

    refreshTrafficMutation.mutate();
  }, [subscription, refreshTrafficMutation]);

  const hasNoSubscription = subscriptionResponse?.has_subscription === false && !subLoading;

  // При живом доступе подключение в карточке остаётся главным действием,
  // а покупка любого следующего тарифа — спокойным второстепенным CTA.
  const hasActiveAccess =
    (subsList?.subscriptions ?? []).some((s) => s.status === 'active' || s.status === 'limited') ||
    (!!subscription &&
      !subscription.is_expired &&
      (subscription.status === 'active' || subscription.status === 'limited'));

  const userName = displayName(user);
  const { appName, logoLetter, brandingReady } = useBranding();
  const { giftEnabled } = useFeatureFlags();

  // Фото профиля Telegram (прокси бота); без него — брендовая буква.
  const { data: avatarData, isPending: avatarPending } = useQuery({
    queryKey: ['user-avatar'],
    queryFn: authApi.getMyAvatar,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const avatarUrl = avatarData?.photo_url ?? null;
  // Пока не ясно, есть ли фото и какая буква бренда, плитка пустая: иначе
  // сначала мелькала запасная «V», потом «S», потом фото.
  const showAvatarLetter = !avatarPending && brandingReady;

  // Состояние доступа известно только когда пришли список подписок и сама
  // подписка. До этого всё, что от него зависит, — заглушки:
  // раньше главная сначала рисовала «Продлить · Тарифы» и «Закончилась», а через
  // мгновение — «Подключить» и «214 дней».
  // Если запросы упали, статус неизвестен. Выводить из пустых данных «Закончилась» нельзя:
  // платящий человек видит красный статус и кнопку продления из-за сбоя сети.
  const statusUnknown =
    !hasActiveAccess && ((subsListError && !subsList) || (subError && !subscriptionResponse));
  const statusReady = !subsListPending && !subLoading && !statusUnknown;

  // biome-ignore lint/correctness/useExhaustiveDependencies: subsListErrorAt, subErrorAt — намеренный повод перезапуска
  useEffect(() => {
    if (!statusUnknown) return;
    const timer = setTimeout(
      () => {
        void refetchSubsList();
        void refetchSub();
      },
      15_000 + Math.random() * 5_000,
    );
    return () => clearTimeout(timer);
  }, [statusUnknown, subsListErrorAt, subErrorAt, refetchSubsList, refetchSub]);

  // Статус доступа одной фразой: главный вопрос главной — «работает ли моя подписка».
  const status: 'active' | 'expired' | 'none' = hasActiveAccess
    ? 'active'
    : !hasNoSubscription
      ? 'expired'
      : 'none';
  const firstSubId = subscription?.id;
  // Дней до конца считаем от end_date.
  const focusSub = subscription;
  const focusLifetime = isLifetimeSubscription(focusSub);
  const daysLeft = useMemo(() => {
    if (!focusSub?.end_date) return undefined;
    const ms = new Date(focusSub.end_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }, [focusSub?.end_date]);
  // Пробный период не продлевается (у бота для него нет периодов продления): «Продлить»
  // вёл на пустой экран «Нет вариантов продления» вместо витрины тарифов.
  const focusTrial = Boolean(focusSub?.is_trial);
  const renewTo = focusTrial
    ? '/subscription/purchase'
    : firstSubId != null
      ? `/subscriptions/${firstSubId}/renew`
      : '/subscriptions';
  const connectTo = firstSubId != null ? `/connection?sub=${firstSubId}` : '/connection';
  // Главная одной карточкой (StatusCard) — для обычной подписки. Суточный тариф
  // остаётся на прежней раскладке: у него своя карточка и своё «продлить».
  const legacyLayout = Boolean(subscription?.is_daily);

  return (
    <div className="mx-auto w-full max-w-[600px] space-y-5">
      {/* Шапка профиля: в профиль ведёт только сама аватарка (раньше ссылкой
          была вся полоса до подарка — уводило даже от касания рядом с именем).
          Под именем только ID: пилюля промогруппы («Пользователь») — лишний статус. */}
      <div className="flex items-center gap-3" data-onboarding="welcome">
        <Link
          to="/profile"
          aria-label={t('nav.profile')}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent-500/10 transition-opacity hover:opacity-85"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : showAvatarLetter ? (
            <span className="font-display text-lg font-bold text-accent-300">
              {logoLetter.toUpperCase()}
            </span>
          ) : null}
        </Link>
        <div className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold tracking-tight text-dark-50">
            {userName || appName}
          </span>
          {user?.id != null && (
            <span className="mt-1 block text-xs font-medium text-dark-400">ID {user.id}</span>
          )}
        </div>
        {giftEnabled && (
          <Link
            to="/gift"
            aria-label={t('nav.gift')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-dark-800/50 text-dark-300 transition-colors hover:text-accent-300"
          >
            <GiftIcon className="h-5 w-5" />
          </Link>
        )}
      </div>

      {/* Без подписки главное — пробный период: его кнопка должна быть на первом экране,
          внизу она оказывалась под панелью навигации. */}
      {hasNoSubscription && !trialLoading && trialInfo?.is_available && (
        <TrialOfferCard
          trialInfo={trialInfo}
          activateTrialMutation={activateTrialMutation}
          trialError={trialError}
        />
      )}

      {/* Сторис — самый верх под шапкой: инструкция рядом с входом, не ниже
          сгиба, раньше любых карточек. Без заголовка — лента говорит сама. */}
      <section aria-label={t('dashboard.storiesTitle')} className="-mt-1">
        <StoryRail />
      </section>

      {/* Запросы подписки упали: вместо вечных заглушек — что случилось и «Повторить». */}
      {statusUnknown && (
        <Surface className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-[15px] font-semibold text-dark-100">
            {t('dashboard.loadFailed', 'Не удалось загрузить')}
          </span>
          <Button
            tone="secondary"
            className="h-11 shrink-0"
            onClick={() => {
              void refetchSubsList();
              void refetchSub();
            }}
          >
            {t('common.retry')}
          </Button>
        </Surface>
      )}

      {legacyLayout ? (
        <>
          {/* Главное действие для состояния + три спокойных */}
          <QuickActions
            loading={!statusReady}
            state={status}
            renewTo={renewTo}
            connectTo={connectTo}
            lifetime={focusLifetime}
            trial={focusTrial}
            endingSoon={status === 'active' && daysLeft != null && daysLeft <= 3}
          />

          {/* Подписка + Баланс */}
          <InfoCards
            status={status}
            daysLeft={daysLeft}
            endDate={focusSub?.end_date}
            isTrial={Boolean(focusSub?.is_trial)}
            isLifetime={focusLifetime}
            tariffName={plainTariffName(focusSub?.tariff_name) ?? null}
            balanceRubles={balanceData?.balance_rubles}
            fromFriendsRubles={referralInfo?.available_balance_rubles ?? null}
            loading={!statusReady}
            renewTo={renewTo}
          />
        </>
      ) : (
        // Одна карточка: статус, главная кнопка, строки с действиями (12.11).
        // При сбое запросов статус неизвестен — выше уже стоит «Не удалось загрузить».
        !statusUnknown && (
          <StatusCard
            loading={
              !statusReady ||
              (hasNoSubscription && trialLoading) ||
              // Пробному кнопку выбираем по числу устройств — ждём его, а не меняем кнопку на глазах.
              (status === 'active' && focusTrial && devicesLoading)
            }
            state={status}
            subscriptionId={subscription?.id}
            endDate={subscription?.end_date}
            daysLeft={daysLeft}
            trial={focusTrial}
            lifetime={focusLifetime}
            limited={Boolean(subscription?.is_limited)}
            needsTariff={needsTariff(subscription)}
            tariffName={plainTariffName(subscription?.tariff_name) ?? null}
            connectTo={connectTo}
            renewTo={renewTo}
            connectedDevices={devicesData?.total}
            deviceLimit={subscription?.device_limit}
            trafficLimitGb={subscription?.traffic_limit_gb}
            trafficUsedGb={trafficData?.traffic_used_gb ?? subscription?.traffic_used_gb}
            bypassQuota={subscription?.bypass_quota}
            bypassSuspended={subscription?.bypass_suspended}
            balanceRubles={balanceData?.balance_rubles}
            fromFriendsRubles={referralInfo?.available_balance_rubles ?? null}
            quietAction={status === 'none' && Boolean(trialInfo?.is_available)}
          />
        )
      )}

      {/* Pending Gift Activations */}
      {pendingGifts && pendingGifts.length > 0 && <PendingGiftCard gifts={pendingGifts} />}

      {/* Subscription Status Card — только у суточного тарифа: остальным всё это показывает StatusCard */}
      {legacyLayout &&
        (subLoading ? (
          <SkeletonGroup className="rounded-3xl bg-dark-900/70 p-4">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </SkeletonGroup>
        ) : subscription?.is_expired ||
          subscription?.status === 'disabled' ||
          subscription?.is_limited ? (
          <SubscriptionCardExpired
            subscription={subscription}
            balanceKopeks={balanceData?.balance_kopeks ?? 0}
            balanceRubles={balanceData?.balance_rubles ?? 0}
          />
        ) : subscription ? (
          <DevicesTrafficCard
            subscriptionId={subscription.id}
            isTrial={subscription.is_trial}
            deviceLimit={subscription.device_limit}
            devices={devicesData?.devices ?? []}
            connectedDevices={devicesData?.total ?? 0}
            trafficLimitGb={subscription.traffic_limit_gb}
            trafficUsedGb={trafficData?.traffic_used_gb ?? subscription.traffic_used_gb}
            bypassQuota={subscription.bypass_quota}
            bypassSuspended={subscription.bypass_suspended}
          />
        ) : null)}

      {/* Promo Offers */}
      <PromoOffersSection />

      {/* Fortune Wheel Banner */}
      {wheelConfig?.is_enabled && (
        <Link
          to="/wheel"
          className="rounded-3xl bg-dark-900/70 cursor-pointer transition-colors hover:bg-dark-800/50 active:bg-dark-800/70 group flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-accent-400 light:text-accent-500 [&>svg]:h-[22px] [&>svg]:w-[22px]">
              <WheelIcon />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-dark-100">
                {(wheelConfig.free_spins ?? 0) > 0
                  ? t('wheel.banner.freeTitle', {
                      count: wheelConfig.free_spins,
                    })
                  : t('wheel.banner.title')}
              </h3>
              <p className="text-[13px] text-dark-400">
                {wheelConfig.topup_spins_enabled && wheelConfig.topup_spin_threshold_kopeks
                  ? t('wheel.banner.topupDescription', {
                      amount: formatPriceShort(wheelConfig.topup_spin_threshold_kopeks),
                    })
                  : t('wheel.banner.description')}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 text-dark-500 transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent-400">
            <ChevronRightIcon />
          </div>
        </Link>
      )}

      {/* Напоминания (админка → Напоминания) */}
      <ReminderCards />

      {/* Полезное: то, чего нет в карточках выше */}
      {/* В старой раскладке промокод уже в быстрых действиях — без подписки и у истёкшего пробного периода. */}
      <UsefulGrid
        hidePromocode={
          legacyLayout && statusReady && (status === 'none' || (status === 'expired' && focusTrial))
        }
      />
    </div>
  );
}
