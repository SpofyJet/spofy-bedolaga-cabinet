import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { HIDDEN_UNDER_KEYBOARD, useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';
import { PowerIcon } from '@/components/icons';

import { HomeIcon, WheelIcon, UsersIcon, ChatIcon, UserIcon } from './icons';
import type { MobileNavItem, MobileNavKey } from './mobileNavRoutes';

type NavIcon = React.ComponentType<{ className?: string }>;

const ICONS: Record<MobileNavKey, NavIcon> = {
  dashboard: HomeIcon,
  wheel: WheelIcon,
  referral: UsersIcon,
  support: ChatIcon,
  profile: UserIcon,
};

interface MobileBottomNavProps {
  /** Экраны панели — из mobileNavItems(); AppShell рендерит панель только на них. */
  items: readonly MobileNavItem[];
  /** Центральная кнопка подключения — первый маршрут подключения из AppShell. */
  connectTo?: string;
  /** Открыто выезжающее меню шапки: у него есть все те же пункты, панель поверх него лишняя. */
  isMenuOpen?: boolean;
}

export function MobileBottomNav({ items, connectTo, isMenuOpen = false }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { haptic } = usePlatform();
  const isKeyboardOpen = useVirtualKeyboard();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleNavClick = () => {
    haptic.impact('light');
  };

  return (
    <nav
      className={cn(
        'fixed z-50 transition-all duration-200 lg:hidden',
        'bg-dark-900/95 backdrop-blur-linear',
        'border border-dark-700/30',
        isKeyboardOpen || isMenuOpen ? HIDDEN_UNDER_KEYBOARD : 'opacity-100',
      )}
      style={{
        // Отступ снизу и просвет под панелью объявлены в globals.css
        // (--mobile-nav-*): в standalone iOS inset около 34pt, и панель стоит
        // вплотную к безопасной зоне, в браузере — 16px.
        bottom: 'var(--mobile-nav-offset)',
        // По бокам та же логика: в альбомной ориентации iPhone вырезы слева и
        // справа около 59pt, панель не должна уходить под чёлку и углы.
        left: 'max(16px, env(safe-area-inset-left, 0px))',
        right: 'max(16px, env(safe-area-inset-right, 0px))',
        borderRadius: 'var(--bento-radius, 24px)',
        padding: '8px 4px',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      }}
    >
      <div className="flex justify-around">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                // Четыре вкладки — у каждой в запасе ~85px, подпись помещается
                // без многоточия даже с длинными переводами (fa/zh).
                'relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-0 py-2.5 transition-all duration-200',
                isActive(item.path) ? 'text-accent-400' : 'text-dark-400 hover:text-dark-200',
              )}
            >
              {isActive(item.path) && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute top-1.5 h-9 w-9 rounded-xl bg-accent-500/15 ring-1 ring-accent-500/25"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <Icon className="relative z-10 h-5 w-5" />
              <span
                className={cn(
                  'relative z-10 mt-1 max-w-full truncate text-2xs transition-colors',
                  isActive(item.path) ? 'font-semibold text-dark-100' : 'font-medium',
                )}
              >
                {t(`navShort.${item.key}`, { defaultValue: t(`nav.${item.key}`) })}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Центральная кнопка подключения — главный жест VPN, как у топовых
          клиентов: круг с иконкой питания на верхней кромке панели. */}
      {connectTo && (
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2"
        >
          <Link
            to={connectTo}
            onClick={handleNavClick}
            aria-label={t('dashboard.quick.connect')}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-accent-300/60 bg-gradient-to-b from-accent-400 to-accent-600 text-on-accent transition-shadow duration-200 hover:shadow-[0_0_32px_-6px_rgba(var(--color-accent-500),0.7)]"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 20px -6px rgba(var(--color-accent-500),0.55), 0 0 0 4px rgb(var(--color-dark-950))',
            }}
          >
            <PowerIcon className="h-6 w-6" />
          </Link>
        </motion.div>
      )}
    </nav>
  );
}
