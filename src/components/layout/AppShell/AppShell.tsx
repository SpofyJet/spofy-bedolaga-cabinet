import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useAuthStore } from '@/store/auth';
import { useHaptic } from '@/platform';
import { useTelegramSDK } from '@/hooks/useTelegramSDK';
import { headerHeightCss, useHeaderHeight } from '@/hooks/useHeaderHeight';
import { useTheme } from '@/hooks/useTheme';
import { useBranding } from '@/hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useLiteMode } from '@/hooks/useLiteMode';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { resetVirtualKeyboard } from '@/hooks/useVirtualKeyboard';
import { themeColorsApi } from '@/api/themeColors';
import { useSupportUnread } from '@/hooks/useSupportUnread';
import { cn } from '@/lib/utils';

import WebSocketNotifications from '@/components/WebSocketNotifications';
import CampaignBonusNotifier from '@/components/CampaignBonusNotifier';
import SuccessNotificationModal from '@/components/SuccessNotificationModal';
import { PromptDialogHost } from '@/components/PromptDialogHost';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TicketNotificationBell from '@/components/TicketNotificationBell';
import {
  SubscriptionIcon,
  HomeIcon,
  CreditCardIcon,
  ChatIcon,
  UserIcon,
  UsersIcon,
  ShieldIcon,
  SunIcon,
  MoonIcon,
  PowerIcon,
} from '@/components/icons';

import { MobileBottomNav } from './MobileBottomNav';
import { isMobileNavScreen, mobileNavItems } from './mobileNavRoutes';
import { subscriptionApi } from '@/api/subscription';
import { API } from '@/config/constants';
import { AppHeader } from './AppHeader';
import { LogoutButton } from './LogoutButton';
import { useBackgroundConsumer } from '@/components/backgrounds/BackgroundHost';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const logout = useAuthStore((state) => state.logout);
  const { isFullscreen, safeAreaInset, contentSafeAreaInset, platform, isMobile } =
    useTelegramSDK();
  const {
    mobileCss: headerHeight,
    topSafeArea,
    isMobileFullscreen: isTgFullscreen,
  } = useHeaderHeight();
  // Без шапки на телефоне сверху остаётся только безопасная зона: вырез/статус-бар
  // и кнопки Telegram в fullscreen.
  const topInsetCss = headerHeightCss(topSafeArea, isTgFullscreen);
  const haptic = useHaptic();
  const { toggleTheme, isDark } = useTheme();

  // Extracted hooks
  const { appName, logoLetter, hasCustomLogo, logoUrl } = useBranding();
  // Лого показывается по факту загрузки картинки, а не по флагу предзагрузки:
  // флаг не реактивен, и после первой загрузки лого оставалось невидимым.
  const [loadedLogoUrl, setLoadedLogoUrl] = useState<string | null>(null);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoShown = !!logoUrl && loadedLogoUrl === logoUrl && failedLogoUrl !== logoUrl;
  const { referralEnabled, wheelEnabled, giftEnabled } = useFeatureFlags();
  const { lite } = useLiteMode();
  useScrollRestoration();
  // Анимированный фон рендерит BackgroundHost в App (не перемонтируется при
  // смене роута) — здесь только регистрируем, что на этом роуте он нужен.
  useBackgroundConsumer();

  // Theme toggle visibility
  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
    staleTime: 1000 * 60 * 5,
  });
  const canToggleTheme = enabledThemes?.dark && enabledThemes?.light;

  // Only apply fullscreen UI adjustments on mobile Telegram (iOS/Android)
  const isMobileFullscreen = isFullscreen && isMobile;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Смена экрана закрывает сигнал «клавиатура открыта» (useVirtualKeyboard):
  // поле с фокусом размонтировано, blur не приходит, и прижатые к низу элементы
  // иначе остаются спрятанными.
  // biome-ignore lint/correctness/useExhaustiveDependencies: путь нужен как триггер — сброс на каждой смене экрана
  useEffect(() => {
    resetVirtualKeyboard();
  }, [location.pathname]);

  // Нижняя панель живёт только на экранах своих кнопок; на остальных её нет и
  // место под неё не резервируется (data-mobile-nav="off" → --mobile-nav-clearance).
  const navItems = mobileNavItems({ wheelEnabled, referralEnabled, lite });
  const showMobileNav = isMobileNavScreen(location.pathname, navItems);

  // Кнопка «Подключить» в шапке ведёт сразу на маршрут подключения активной
  // подписки. Те же queryKey, что на дашборде — оболочка и главная делят кэш.
  const { data: navMultiSub } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const navIsMultiTariff = navMultiSub?.multi_tariff_enabled ?? false;
  const { data: navSingleSub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: API.BALANCE_STALE_TIME_MS,
    enabled: !navIsMultiTariff,
  });
  const navFirstSubId = navIsMultiTariff
    ? navMultiSub?.subscriptions?.[0]?.id
    : navSingleSub?.subscription?.id;
  const connectTo = navFirstSubId != null ? `/connection?sub=${navFirstSubId}` : '/connection';

  // Desktop navigation — labels always visible (no hover-reveal gimmick)
  // Админка живёт со своей шапкой (меню, колокольчик тикетов); экраны
  // покупателя — без мобильной шапки и с короткой капсулой на ПК.
  const isAdminRoute = location.pathname.startsWith('/admin');
  const supportUnread = useSupportUnread(!isAdminRoute);

  // Те же разделы, что и в нижней панели телефона, плюс подписка и баланс.
  // Подарок, инструкции, язык, тема и выход — в профиле и на главной.
  const desktopNav = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: CreditCardIcon },
    ...(referralEnabled
      ? [{ path: '/referral', label: t('navShort.referral', t('nav.referral')), icon: UsersIcon }]
      : []),
    { path: '/support', label: t('nav.support'), icon: ChatIcon, dot: supportUnread > 0 },
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    haptic.impact('light');
  };

  // A single elegant nav link: icon + label always visible, with a shared
  // framer-motion pill that slides to the active item on navigation.
  const renderNavLink = (
    path: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    admin = false,
    dot = false,
  ) => {
    const active = admin ? location.pathname.startsWith('/admin') : isActive(path);
    return (
      <Link
        key={path}
        to={path}
        onClick={handleNavClick}
        aria-label={label}
        className={cn(
          'relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-200',
          active
            ? admin
              ? 'text-warning-300'
              : 'text-dark-50'
            : admin
              ? 'text-warning-500 hover:bg-warning-500/10 hover:text-warning-300'
              : 'text-dark-400 hover:bg-dark-800/60 hover:text-dark-100',
        )}
      >
        {active && (
          <motion.span
            layoutId="desktop-nav-active"
            className={cn(
              // Подсветка-пилюля активного пункта — «приподнята» над треком капсулы
              'absolute inset-0 rounded-full',
              admin ? 'bg-warning-500/15' : 'bg-dark-700/80',
            )}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <Icon className="relative h-4 w-4 shrink-0" />
        <span className="relative whitespace-nowrap">{label}</span>
        {dot && (
          <span
            className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-error-500"
            aria-label={t('support.chat.unread', 'Новый ответ')}
          />
        )}
      </Link>
    );
  };

  // headerHeight comes from useHeaderHeight() — accounts for TG safe area in fullscreen

  return (
    <div className="min-h-viewport" data-mobile-nav={showMobileNav ? 'on' : 'off'}>
      {/* Global components */}
      <WebSocketNotifications />
      <CampaignBonusNotifier />
      <SuccessNotificationModal />
      <PromptDialogHost />

      {/* Desktop Header */}
      {/* w-screen вместо left-0 right-0: right-0 упирается в край вьюпорта БЕЗ
          скроллбара, и капсула по центру прыгала бы на полширины скроллбара при
          переходах между страницами со скроллом и без. 100vw даёт ту же ось
          центрирования, что и у body (тоже 100vw). */}
      <header className="header-tint fixed left-0 top-0 z-50 hidden w-screen border-b border-dark-800/50 bg-dark-950/95 lg:block">
        {/* 3-зонный grid: лого | капсула | действия. Колонки 1fr_auto_1fr держат
            капсулу строго по центру вьюпорта НЕЗАВИСИМО от ширины лого/действий,
            а действия — у правого края. Поэтому ничего не «скачет» при переходах
            (в т.ч. в админку): смена ширины в одной зоне не двигает другие. */}
        <div className="mx-auto grid h-14 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 justify-self-start"
            onClick={handleNavClick}
          >
            <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-dark-800">
              <span
                className={cn(
                  'absolute text-sm font-bold text-accent-400 transition-opacity duration-200',
                  hasCustomLogo && logoShown ? 'opacity-0' : 'opacity-100',
                )}
              >
                {logoLetter}
              </span>
              {hasCustomLogo && logoUrl && logoUrl !== failedLogoUrl && (
                <img
                  src={logoUrl}
                  alt={appName || 'Logo'}
                  onLoad={() => setLoadedLogoUrl(logoUrl)}
                  onError={() => setFailedLogoUrl(logoUrl)}
                  className={cn(
                    'absolute h-full w-full object-contain transition-opacity duration-200',
                    logoShown ? 'opacity-100' : 'opacity-0',
                  )}
                />
              )}
            </div>
            <span className="text-base font-semibold text-dark-100">{appName}</span>
          </Link>

          {/* Navigation — единая «капсула» (segmented control): все пункты видны
              всегда, без скролла/сжатия/сворачивания. Центрируется средней
              колонкой grid (justify-self-center), а не auto-margin'ами. */}
          <nav className="flex items-center gap-0.5 justify-self-center rounded-full bg-dark-900/70 p-1">
            {desktopNav.map((item) =>
              renderNavLink(item.path, item.label, item.icon, false, 'dot' in item && !!item.dot),
            )}
            {isAdmin && (
              <>
                <div className="mx-1 h-5 w-px shrink-0 bg-dark-700/60" />
                {renderNavLink('/admin', t('admin.nav.title'), ShieldIcon, true)}
              </>
            )}
          </nav>

          {/* Правая зона: в админке — инструменты, у покупателя — одно главное действие.
              Тема, язык и выход у покупателя — в профиле. */}
          {isAdminRoute ? (
            <div className="flex shrink-0 items-center gap-2 justify-self-end">
              <button
                onClick={() => {
                  haptic.impact('light');
                  toggleTheme();
                }}
                className={cn(
                  'rounded-xl bg-dark-800/50 p-2 text-dark-400 transition-colors duration-200 hover:bg-dark-700 hover:text-accent-400',
                  !canToggleTheme && 'hidden',
                )}
                aria-label={
                  isDark ? t('theme.light') || 'Light mode' : t('theme.dark') || 'Dark mode'
                }
                title={isDark ? t('theme.light') || 'Light mode' : t('theme.dark') || 'Dark mode'}
              >
                {isDark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
              </button>
              <TicketNotificationBell isAdmin={location.pathname.startsWith('/admin')} />
              <LanguageSwitcher />
              <LogoutButton
                variant="icon"
                onLogout={() => {
                  haptic.impact('light');
                  logout();
                }}
              />
            </div>
          ) : (
            <div className="flex shrink-0 items-center justify-self-end">
              {/* Шапка есть на каждой странице: коралловая кнопка здесь давала
                  вторую «главную» рядом с главной кнопкой самой страницы. */}
              <Link
                to={connectTo}
                onClick={handleNavClick}
                className="flex items-center gap-2 rounded-full bg-accent-500/15 px-4 py-2 text-[13px] font-semibold text-accent-300 transition-colors hover:bg-accent-500/25"
              >
                <PowerIcon className="h-4 w-4" />
                {t('dashboard.quick.connect')}
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Header — только в админке */}
      {isAdminRoute && (
        <AppHeader
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onCommandPaletteOpen={() => {}}
          headerHeight={headerHeight}
          isFullscreen={isMobileFullscreen}
          safeAreaInset={safeAreaInset}
          contentSafeAreaInset={contentSafeAreaInset}
          telegramPlatform={platform}
          wheelEnabled={wheelEnabled}
          referralEnabled={referralEnabled}
          giftEnabled={giftEnabled}
        />
      )}

      {/* Подложка под статус-бар / кнопки Telegram: контент не просвечивает под ними */}
      {!isAdminRoute && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-dark-950/85 lg:hidden"
          style={{ height: topInsetCss }}
        />
      )}

      {/* Desktop spacer */}
      <div className="hidden h-14 lg:block" />

      {/* Mobile spacer */}
      <div className="lg:hidden" style={{ height: isAdminRoute ? headerHeight : topInsetCss }} />

      {/* Main content */}
      {/* Боковые отступы не меньше вырезов (альбомная ориентация iPhone); снизу —
          просвет под панелью: фиксированные 112px в standalone iOS не хватало,
          и низ контента уходил под неё. */}
      <main className="mx-auto max-w-6xl py-6 pb-[calc(var(--mobile-nav-clearance)+0.5rem)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] lg:px-6 lg:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation — только на экранах её кнопок */}
      {showMobileNav && (
        <MobileBottomNav
          items={navItems}
          isMenuOpen={mobileMenuOpen}
          badges={{ support: supportUnread > 0 }}
        />
      )}
    </div>
  );
}
