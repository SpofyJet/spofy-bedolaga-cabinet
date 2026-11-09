import { useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { openLink as sdkOpenLink } from '@telegram-apps/sdk-react';
import { subscriptionApi } from '../api/subscription';
import { useTelegramSDK } from '../hooks/useTelegramSDK';
import { useHaptic } from '@/platform';
import { PiDeviceMobileDuotone, PiGearSixDuotone, PiQrCodeBold } from 'react-icons/pi';
import { resolveTemplate, hasTemplates } from '../utils/templateEngine';
import { openAppScheme } from '../utils/openAppScheme';
import { isHappCryptolinkMode, resolveConnectionUrlForUi } from '../utils/connectionLink';
import { useAuthStore } from '../store/auth';
import type { AppConfig } from '../types';
import ConnectGuide, { connectablePlatforms } from '../components/connection/ConnectGuide';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Page } from '@/components/spofy/ui';

export default function Connection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subId = searchParams.get('sub') ? Number(searchParams.get('sub')) : undefined;
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const { isTelegramWebApp } = useTelegramSDK();
  const { impact: hapticImpact } = useHaptic();

  const hapticRef = useRef(hapticImpact);
  hapticRef.current = hapticImpact;

  const {
    data: appConfig,
    isLoading,
    error,
  } = useQuery<AppConfig>({
    queryKey: ['appConfig', subId],
    queryFn: () => subscriptionApi.getAppConfig(subId),
  });
  const { data: connectionLink, isLoading: isConnectionLinkLoading } = useQuery({
    queryKey: ['connectionLink', subId],
    queryFn: () => subscriptionApi.getConnectionLink(subId),
    retry: false,
    staleTime: 0,
  });

  const qrConnectionUrl = useMemo(
    () =>
      resolveConnectionUrlForUi({
        mode: connectionLink?.connect_mode,
        happSchemeLink: connectionLink?.happ_scheme_link,
        displayLink: connectionLink?.display_link,
        subscriptionUrl: connectionLink?.subscription_url,
        happCryptLink: connectionLink?.happ_cryptolink,
        happCryptoLink: connectionLink?.happ_crypto_link,
        happLink: connectionLink?.happ_link,
        fallbackUrl: appConfig?.subscriptionUrl,
      }),
    [
      appConfig?.subscriptionUrl,
      connectionLink?.connect_mode,
      connectionLink?.display_link,
      connectionLink?.happ_cryptolink,
      connectionLink?.happ_crypto_link,
      connectionLink?.happ_link,
      connectionLink?.happ_scheme_link,
      connectionLink?.subscription_url,
    ],
  );

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleOpenQR = useCallback(() => {
    if (!qrConnectionUrl) return;
    navigate('/connection/qr', {
      replace: !isTelegramWebApp,
      state: {
        url: qrConnectionUrl,
        hideLink: connectionLink?.hide_link ?? appConfig?.hideLink ?? false,
        subscriptionId: subId,
      },
    });
  }, [
    navigate,
    qrConnectionUrl,
    connectionLink?.hide_link,
    appConfig?.hideLink,
    isTelegramWebApp,
    subId,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleGoBack();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleGoBack]);

  const resolveUrl = useCallback(
    (url: string): string => {
      if (!hasTemplates(url) || !appConfig?.subscriptionUrl) return url;
      return resolveTemplate(url, {
        subscriptionUrl: appConfig.subscriptionUrl,
        username: user?.username ?? undefined,
      });
    },
    [appConfig?.subscriptionUrl, user?.username],
  );

  const openDeepLink = useCallback(
    (deepLink: string) => {
      let resolved = deepLink;
      if (hasTemplates(resolved)) {
        resolved = resolveUrl(resolved);
      }
      // In HAPP cryptolink mode keep hiding the plain subscription link: force the
      // happ://crypt... URL only when the button fell back to it or its template
      // could not be resolved. An explicit link from the panel's Subpage config
      // (e.g. happ://add/...) wins — admins expect Subpage edits to apply here.
      if (
        isHappCryptolinkMode(connectionLink?.connect_mode) &&
        qrConnectionUrl &&
        (!resolved || resolved === appConfig?.subscriptionUrl || hasTemplates(resolved))
      ) {
        resolved = qrConnectionUrl;
      }
      const isHttpUrl = /^https?:\/\//i.test(resolved);
      const finalUrlForTelegram = isHttpUrl
        ? resolved
        : `${window.location.origin}/miniapp/redirect.html?url=${encodeURIComponent(resolved)}&lang=${i18n.language || 'en'}`;

      if (isTelegramWebApp) {
        try {
          sdkOpenLink(finalUrlForTelegram, { tryInstantView: false });
          return;
        } catch {
          // SDK not available, fallback
        }
      }

      // In regular browsers open the deeplink directly. openAppScheme uses a contained
      // iframe for custom schemes so an unresolved scheme doesn't paint a full-page
      // net::ERR_UNKNOWN_URL_SCHEME (Android) / silently fail (iOS); http(s) links
      // still navigate normally. (Telegram bug #654272.)
      openAppScheme(resolved);
    },
    [
      isTelegramWebApp,
      i18n.language,
      resolveUrl,
      connectionLink?.connect_mode,
      qrConnectionUrl,
      appConfig?.subscriptionUrl,
    ],
  );

  // Есть ли что показать: платформы с Happ/INCY (или с приложениями панели, если их нет).
  const hasApps = useMemo(() => {
    if (!appConfig?.platforms) return false;
    return connectablePlatforms(appConfig).available.length > 0;
  }, [appConfig]);

  // «Скопировать ссылку» в шаге без своей кнопки копирования: в режиме HAPP
  // cryptolink — зашифрованная ссылка (обычную там не показываем), иначе обычная.
  const copyUrl = isHappCryptolinkMode(connectionLink?.connect_mode)
    ? qrConnectionUrl || null
    : (appConfig?.subscriptionUrl ?? null);
  const backTo = subId ? `/subscriptions/${subId}` : '/subscription';
  const title = t('subscription.connection.title');

  if (isLoading || isConnectionLinkLoading) {
    return (
      <Page>
        <PageHeader title={title} backTo={backTo} />
        <SkeletonGroup className="space-y-6">
          {/* Повторяет раскладку: строка устройства, приложения, шаги. */}
          <Skeleton className="h-12 rounded-2xl" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton count={2} className="h-16 rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </SkeletonGroup>
      </Page>
    );
  }

  if (error || !appConfig || !hasApps) {
    return (
      <Page>
        <PageHeader title={title} backTo={backTo} />
        <EmptyState
          icon={<PiDeviceMobileDuotone />}
          title={t('subscription.connection.notConfigured')}
          text={
            isAdmin
              ? t('subscription.connection.notConfiguredAdmin')
              : t('subscription.connection.notConfiguredUser')
          }
          action={
            isAdmin ? (
              <Link
                to="/admin/apps"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cta-500 px-5 text-[15px] font-semibold text-on-cta transition-colors hover:bg-cta-600"
              >
                <PiGearSixDuotone className="h-5 w-5" />
                {t('subscription.connection.goToApps')}
              </Link>
            ) : undefined
          }
        />
      </Page>
    );
  }

  // No subscription
  if (!appConfig.hasSubscription) {
    return (
      <Page>
        <PageHeader title={title} backTo={backTo} />
        <EmptyState
          icon={<PiDeviceMobileDuotone />}
          title={t('subscription.connection.noSubscription')}
          action={
            <Button tone="secondary" onClick={handleGoBack}>
              {t('common.close')}
            </Button>
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={title}
        backTo={backTo}
        right={
          appConfig.subscriptionUrl ? (
            <button
              type="button"
              onClick={handleOpenQR}
              aria-label={t('subscription.connection.openQr', 'Open QR code')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-dark-900/70 text-dark-200 transition-colors hover:bg-dark-800/70 hover:text-dark-50 active:scale-95"
            >
              <PiQrCodeBold className="h-[18px] w-[18px]" />
            </button>
          ) : undefined
        }
      />
      <ConnectGuide
        appConfig={appConfig}
        onOpenDeepLink={openDeepLink}
        isTelegramWebApp={isTelegramWebApp}
        onOpenQR={handleOpenQR}
        copyUrl={copyUrl}
        username={user?.username ?? undefined}
      />
    </Page>
  );
}
