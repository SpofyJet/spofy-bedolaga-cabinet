import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { HIDDEN_UNDER_KEYBOARD, useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';

import { HomeIcon, SubscriptionIcon, WalletIcon, UsersIcon, ChatIcon, WheelIcon } from './icons';
import type { MobileNavItem, MobileNavKey } from './mobileNavRoutes';

type NavIcon = React.ComponentType<{ className?: string }>;

const ICONS: Record<MobileNavKey, NavIcon> = {
  dashboard: HomeIcon,
  subscription: SubscriptionIcon,
  balance: WalletIcon,
  wheel: WheelIcon,
  referral: UsersIcon,
  support: ChatIcon,
};

interface MobileBottomNavProps {
  /** Экраны панели — из mobileNavItems(); AppShell рендерит панель только на них. */
  items: readonly MobileNavItem[];
  /** Открыто выезжающее меню шапки: у него есть все те же пункты, панель поверх него лишняя. */
  isMenuOpen?: boolean;
}

export function MobileBottomNav({ items, isMenuOpen = false }: MobileBottomNavProps) {
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
    // Пристыкованная панель вкладок (как в нативных приложениях и Telegram):
    // без «парящей капсулы», тени и пружинной плашки. Активная вкладка — цветом.
    <nav
      className={cn(
        'spofy-tabbar fixed inset-x-0 bottom-0 z-50 transition-opacity duration-200 lg:hidden',
        isKeyboardOpen || isMenuOpen ? HIDDEN_UNDER_KEYBOARD : 'opacity-100',
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex h-[58px] items-stretch justify-around">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              aria-current={active ? 'page' : undefined}
              className={cn(
                // На 360 пяти пунктам достаётся по ~64 px: подпись короткая
                // (navShort), а если и она не влезла — многоточие, не наезд.
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150',
                active ? 'text-accent-400' : 'text-dark-400 active:text-dark-200',
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span
                className={cn(
                  'max-w-full truncate px-1 text-[11px] leading-none',
                  active ? 'font-semibold' : 'font-medium',
                )}
              >
                {t(`navShort.${item.key}`, { defaultValue: t(`nav.${item.key}`) })}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
