import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  PiAtDuotone,
  PiBellDuotone,
  PiCaretRightBold,
  PiClockCounterClockwiseDuotone,
  PiDevicesDuotone,
  PiGiftDuotone,
  PiInfoDuotone,
  PiLinkSimpleDuotone,
  PiMoonStarsDuotone,
  PiShieldCheckDuotone,
  PiSignOutDuotone,
  PiTicketDuotone,
  PiTranslateDuotone,
} from 'react-icons/pi';
import type { ReactNode } from 'react';

import { authApi } from '../api/auth';
import { brandingApi } from '../api/branding';
import { infoApi } from '../api/info';
import { notificationsApi } from '../api/notifications';
import { displayName } from '../utils/displayName';
import { useAuthStore } from '../store/auth';
import { useBranding } from '@/hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useTheme } from '@/hooks/useTheme';
import { useHaptic, useIsTelegram } from '@/platform';
import { RowIcon, type Tone } from '@/components/spofy/ui';

/**
 * Профиль — короткое меню: кто я, подписка, аккаунт, настройки, о сервисе.
 * Все детали — на своих страницах; язык и тема переключаются прямо в строке,
 * потому что верхней шапки у пользователя больше нет.
 */
export default function Profile() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const logout = useAuthStore((state) => state.logout);
  const { logoLetter } = useBranding();
  const { giftEnabled } = useFeatureFlags();
  const { isDark, setTheme, canToggle } = useTheme();
  const haptic = useHaptic();
  const isTelegram = useIsTelegram();

  const { data: avatarData } = useQuery({
    queryKey: ['user-avatar'],
    queryFn: authApi.getMyAvatar,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const avatarUrl = avatarData?.photo_url ?? null;

  const { data: notificationSettings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
  });
  const notificationsOn = notificationSettings
    ? Boolean(
        notificationSettings.subscription_expiry_enabled ||
          notificationSettings.traffic_warning_enabled ||
          notificationSettings.balance_low_enabled ||
          notificationSettings.news_enabled ||
          notificationSettings.promo_offers_enabled,
      )
    : null;

  const { data: emailAuth } = useQuery({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    staleTime: 60_000,
  });

  const { data: languagesData } = useQuery({
    queryKey: ['languages'],
    queryFn: infoApi.getLanguages,
    staleTime: 5 * 60_000,
  });
  const languages = languagesData?.languages ?? [];
  const currentLang = i18n.language?.split('-')[0];

  const signIn = user?.telegram_id != null ? 'Telegram' : user?.email ? 'Email' : null;

  return (
    <div className="mx-auto w-full max-w-[600px] space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-dark-50 sm:text-2xl">
        {t('profile.title')}
      </h1>

      {/* Кто я */}
      <div className="flex items-center gap-4 rounded-3xl bg-dark-900/70 p-4 ring-1 ring-inset ring-dark-800/80">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent-500/15">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-xl font-bold text-accent-400">
              {(displayName(user)?.[0] ?? logoLetter).toUpperCase()}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold tracking-tight text-dark-50">
            {displayName(user)}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-dark-400">
            ID {user?.id ?? '—'}
            {signIn && <> · {t('profile.menu.signInWith', { method: signIn })}</>}
          </span>
        </span>
      </div>

      <MenuGroup title={t('profile.menu.section.subscription')}>
        <MenuLink
          to="/connection"
          tone="devices"
          icon={<PiDevicesDuotone />}
          label={t('profile.menu.devices')}
        />
        <MenuLink
          to="/balance?section=history"
          tone="money"
          icon={<PiClockCounterClockwiseDuotone />}
          label={t('profile.menu.paymentHistory')}
        />
        <MenuLink
          to="/balance?section=promo"
          tone="promo"
          icon={<PiTicketDuotone />}
          label={t('profile.menu.promocode')}
        />
        {Boolean(giftEnabled) && (
          <MenuLink
            to="/gift"
            tone="friends"
            icon={<PiGiftDuotone />}
            label={t('profile.menu.gift')}
          />
        )}
      </MenuGroup>

      <MenuGroup title={t('profile.menu.section.account')}>
        <MenuLink
          to="/profile/accounts"
          tone="account"
          icon={<PiLinkSimpleDuotone />}
          label={t('profile.menu.connected')}
        />
        <MenuLink
          to="/profile/notifications"
          tone="notify"
          icon={<PiBellDuotone />}
          label={t('profile.menu.notifications')}
          hint={
            notificationsOn === null
              ? undefined
              : notificationsOn
                ? t('profile.menu.notificationsOn')
                : t('profile.menu.notificationsOff')
          }
        />
        {emailAuth?.enabled !== false && (
          <MenuLink
            to="/profile/email"
            tone="account"
            icon={<PiAtDuotone />}
            label={t('profile.menu.email')}
            hint={user?.email ?? t('profile.menu.emailNotLinked')}
          />
        )}
      </MenuGroup>

      {(languages.length > 1 || canToggle) && (
        <MenuGroup title={t('profile.menu.section.settings')}>
          {languages.length > 1 && (
            <MenuRow tone="muted" icon={<PiTranslateDuotone />} label={t('profile.menu.language')}>
              <Segmented
                label={t('profile.menu.language')}
                value={currentLang}
                options={languages.map((l) => ({ value: l.code, label: l.code.toUpperCase() }))}
                onChange={(code) => {
                  haptic.selection();
                  i18n.changeLanguage(code);
                }}
              />
            </MenuRow>
          )}
          {canToggle && (
            <MenuRow tone="muted" icon={<PiMoonStarsDuotone />} label={t('profile.menu.theme')}>
              <Segmented
                label={t('profile.menu.theme')}
                value={isDark ? 'dark' : 'light'}
                options={[
                  { value: 'dark', label: t('profile.menu.themeDark') },
                  { value: 'light', label: t('profile.menu.themeLight') },
                ]}
                onChange={(v) => {
                  haptic.selection();
                  setTheme(v as 'dark' | 'light');
                }}
              />
            </MenuRow>
          )}
        </MenuGroup>
      )}

      <MenuGroup title={t('profile.menu.section.about')}>
        <MenuLink
          to="/info"
          tone="muted"
          icon={<PiInfoDuotone />}
          label={t('profile.menu.about')}
          hint={t('profile.menu.aboutHint')}
        />
        {isAdmin && (
          <MenuLink
            to="/admin"
            tone="error"
            icon={<PiShieldCheckDuotone />}
            label={t('admin.nav.title')}
          />
        )}
      </MenuGroup>

      {!isTelegram && (
        <button
          type="button"
          onClick={() => {
            haptic.impact('light');
            logout();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-error-400 ring-1 ring-inset ring-dark-800/80 transition-colors hover:bg-error-500/10"
        >
          <PiSignOutDuotone className="h-5 w-5" />
          {t('nav.logout')}
        </button>
      )}
    </div>
  );
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">{title}</h2>
      <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-900/70 ring-1 ring-inset ring-dark-800/80">
        {children}
      </div>
    </section>
  );
}

function MenuLink({
  to,
  icon,
  tone,
  label,
  hint,
}: {
  to: string;
  icon: ReactNode;
  tone?: Tone;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-dark-800/40 active:bg-dark-800/60"
    >
      <RowIcon tone={tone}>{icon}</RowIcon>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-dark-100">
        {label}
      </span>
      {hint && <span className="max-w-[45%] truncate text-[13px] text-dark-400">{hint}</span>}
      <PiCaretRightBold className="h-3.5 w-3.5 shrink-0 text-dark-500" aria-hidden />
    </Link>
  );
}

function MenuRow({
  icon,
  tone,
  label,
  children,
}: {
  icon: ReactNode;
  tone?: Tone;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
      <RowIcon tone={tone}>{icon}</RowIcon>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-dark-100">
        {label}
      </span>
      {children}
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex shrink-0 rounded-xl bg-dark-800/80 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(o.value)}
            className={`min-h-[44px] min-w-[44px] rounded-lg px-3 text-[13px] font-semibold transition-colors ${
              active ? 'bg-dark-600 text-dark-50 shadow-sm' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
