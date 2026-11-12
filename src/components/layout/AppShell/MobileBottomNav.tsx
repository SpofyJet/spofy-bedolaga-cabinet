import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { HIDDEN_UNDER_KEYBOARD, useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';

import { HomeIcon, SubscriptionIcon, WheelIcon, UsersIcon, ChatIcon, UserIcon } from './icons';
import type { MobileNavItem, MobileNavKey } from './mobileNavRoutes';

type NavIcon = React.ComponentType<{ className?: string }>;

const ICONS: Record<MobileNavKey, NavIcon> = {
  dashboard: HomeIcon,
  subscription: SubscriptionIcon,
  wheel: WheelIcon,
  referral: UsersIcon,
  support: ChatIcon,
  profile: UserIcon,
};

interface MobileBottomNavProps {
  /** Экраны панели — из mobileNavItems(); AppShell рендерит панель только на них. */
  items: readonly MobileNavItem[];
  /** Открыто выезжающее меню шапки: у него есть все те же пункты, панель поверх него лишняя. */
  isMenuOpen?: boolean;
  /** Точка на пункте — например, непрочитанный ответ поддержки. */
  badges?: Partial<Record<MobileNavKey, boolean>>;
}

export function MobileBottomNav({ items, isMenuOpen = false, badges = {} }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { haptic } = usePlatform();
  const isKeyboardOpen = useVirtualKeyboard();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleNavClick = () => {
    haptic.impact('light');
  };

  // Пять вкладок: подпись 11px (на экране 320px — 10px), как в системных панелях.
  const compact = items.length >= 5;

  return (
    <>
      {/* Страница уходит под панель мягко, а не торчит обрезанными карточками по её краям. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-dark-950 from-75% to-transparent lg:hidden"
        style={{ height: 'calc(var(--mobile-nav-clearance) + 12px)' }}
      />
      <nav
        className={cn(
          'fixed z-50 transition-all duration-200 lg:hidden',
          'bg-dark-900',
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
                  // До четырёх вкладок у каждой в запасе ~80px. С пятой («Подписка»)
                  // на экране 360px остаётся 64px, и «Поддержка» обычным размером
                  // (71px) обрезалась многоточием — размер подписи ниже зависит от
                  // числа вкладок.
                  'relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-0 py-2.5 transition-all duration-200',
                  isActive(item.path) ? 'text-accent-400' : 'text-dark-400 hover:text-dark-200',
                )}
              >
                {isActive(item.path) && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute top-[7px] h-[26px] w-11 rounded-lg bg-accent-500/15"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  <Icon className="h-5 w-5" />
                  {badges[item.key] && (
                    <span
                      className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-error-500"
                      aria-label={t('support.chat.unread', 'Новый ответ')}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'tile-label relative z-10 mt-2 max-w-full truncate transition-colors',
                    compact ? 'text-[length:clamp(10px,3.05vw,11px)] leading-[14px]' : 'text-2xs',
                    isActive(item.path) ? 'font-semibold text-dark-100' : 'font-medium',
                  )}
                >
                  {t(`navShort.${item.key}`, { defaultValue: t(`nav.${item.key}`) })}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
