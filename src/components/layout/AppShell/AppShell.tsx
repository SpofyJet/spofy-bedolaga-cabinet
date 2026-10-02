import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useAuthStore } from '@/store/auth';
import { useHaptic } from '@/platform';
import { useTelegramSDK } from '@/hooks/useTelegramSDK';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { useTheme } from '@/hooks/useTheme';
import { useBranding } from '@/hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useLiteMode } from '@/hooks/useLiteMode';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { resetVirtualKeyboard } from '@/hooks/useVirtualKeyboard';
import { themeColorsApi } from '@/api/themeColors';
import { cn } from '@/lib/utils';

import WebSocketNotifications from '@/components/WebSocketNotifications';
import CampaignBonusNotifier from '@/components/CampaignBonusNotifier';
import SuccessNotificationModal from '@/components/SuccessNotificationModal';
import { PromptDialogHost } from '@/components/PromptDialogHost';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TicketNotificationBell from '@/components/TicketNotificationBell';
import {
  SubscriptionIcon,
  GiftIcon,
  HomeIcon,
  CreditCardIcon,
  ChatIcon,
  UserIcon,
  UsersIcon,
  InfoIcon,
  SunIcon,
  MoonIcon,
} from '@/components/icons';

import { MobileBottomNav } from './MobileBottomNav';
import { isMobileNavScreen, mobileNavItems } from './mobileNavRoutes';
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
  const { mobileCss: headerHeight } = useHeaderHeight();
  const haptic = useHaptic();
  const { toggleTheme, isDark } = useTheme();

  // Extracted hooks
  const { appName, logoLetter, hasCustomLogo, logoUrl } = useBranding();
  const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();
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
  // Логотип виден только после настоящей загрузки; не раскодировался — остаётся буква.
  const [loadedLogoUrl, setLoadedLogoUrl] = useState<string | null>(null);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoShown = !!logoUrl && loadedLogoUrl === logoUrl && failedLogoUrl !== logoUrl;

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

  // Desktop navigation — labels always visible (no hover-reveal gimmick)
  const desktopNav = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: CreditCardIcon },
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    ...(giftEnabled ? [{ path: '/gift', label: t('nav.gift'), icon: GiftIcon }] : []),
    { path: '/support', label: t('nav.support'), icon: ChatIcon },
    { path: '/info', label: t('nav.info'), icon: InfoIcon },
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    haptic.impact('light');
  };

  // Пункт навигации — только подпись; активный отмечен чертой у нижней
  // границы шапки, черта переезжает за выбранным пунктом.
  const renderNavLink = (path: string, label: string, admin = false) => {
    const active = admin ? location.pathname.startsWith('/admin') : isActive(path);
    return (
      <Link
        key={path}
        to={path}
        onClick={handleNavClick}
        aria-label={label}
        className={cn(
          'relative flex h-14 shrink-0 items-center px-3 text-[14px] font-medium transition-colors duration-150',
          active
            ? admin
              ? 'text-warning-300'
              : 'text-dark-50'
            : admin
              ? 'text-warning-500 hover:text-warning-300'
              : 'text-dark-400 hover:text-dark-100',
        )}
      >
        {active && (
          // Активный пункт — тонкая черта у нижней границы шапки
          <motion.span
            layoutId="desktop-nav-active"
            className={cn(
              'absolute inset-x-3 bottom-0 h-0.5 rounded-full',
              admin ? 'bg-warning-400' : 'bg-accent-500',
            )}
            transition={{ type: 'spring', stiffness: 600, damping: 45 }}
          />
        )}
        <span className="relative whitespace-nowrap">{label}</span>
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
      <header className="fixed left-0 top-0 z-50 hidden w-screen border-b border-[var(--spofy-border)] bg-dark-950/90 backdrop-blur-md lg:block">
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
            <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-accent-500">
              <span
                className={cn(
                  'absolute text-sm font-bold text-on-accent transition-opacity duration-200',
                  hasCustomLogo && logoShown ? 'opacity-0' : 'opacity-100',
                )}
              >
                {logoLetter}
              </span>
              {hasCustomLogo && logoUrl && logoUrl !== failedLogoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  onLoad={() => setLoadedLogoUrl(logoUrl)}
                  onError={() => setFailedLogoUrl(logoUrl)}
                  className={cn(
                    'absolute h-full w-full object-cover transition-opacity duration-200',
                    logoShown ? 'opacity-100' : 'opacity-0',
                  )}
                />
              )}
            </div>
            <span className="text-base font-bold text-dark-50">{appName}</span>
          </Link>

          {/* Navigation — единая «капсула» (segmented control): все пункты видны
              всегда, без скролла/сжатия/сворачивания. Центрируется средней
              колонкой grid (justify-self-center), а не auto-margin'ами. */}
          <nav className="flex items-center justify-self-center">
            {desktopNav.map((item) => renderNavLink(item.path, item.label))}
            {isAdmin && (
              <>
                <div className="mx-2 h-5 w-px shrink-0 bg-dark-50/10" />
                {renderNavLink('/admin', t('admin.nav.title'), true)}
              </>
            )}
          </nav>

          {/* Right side actions — правая колонка grid, прижата к краю, не сжимается */}
          <div className="flex shrink-0 items-center gap-2 justify-self-end">
            <button
              onClick={() => {
                haptic.impact('light');
                toggleTheme();
              }}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-[10px] text-dark-300 transition-colors duration-150 hover:bg-dark-50/[0.06] hover:text-dark-50',
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
        </div>
      </header>

      {/* Mobile Header */}
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
        hasContests={hasContests}
        hasPolls={hasPolls}
        giftEnabled={giftEnabled}
      />

      {/* Desktop spacer */}
      <div className="hidden h-14 lg:block" />

      {/* Mobile spacer */}
      <div className="lg:hidden" style={{ height: headerHeight }} />

      {/* Main content */}
      {/* Боковые отступы не меньше вырезов (альбомная ориентация iPhone); снизу —
          просвет под панелью: фиксированные 112px в standalone iOS не хватало,
          и низ контента уходил под неё. */}
      <main className="mx-auto max-w-6xl py-6 pb-[calc(var(--mobile-nav-clearance)+0.5rem)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] lg:px-6 lg:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation — только на экранах её кнопок */}
      {showMobileNav && <MobileBottomNav items={navItems} isMenuOpen={mobileMenuOpen} />}
    </div>
  );
}
