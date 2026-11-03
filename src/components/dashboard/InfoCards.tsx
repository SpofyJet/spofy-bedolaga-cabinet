import { Link } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

/**
 * Две информационные карточки главной: «Подписка» и «Баланс».
 * Заменяют ушедший hero: вся суть одним взглядом, без арт-объектов и LED.
 * Кликабельны целиком — уводят к управлению.
 */
interface InfoCardsProps {
  /** active | expired | none — вычислено на Dashboard. */
  status: 'active' | 'expired' | 'none';
  /** Дней до конца активной подписки. */
  daysLeft?: number;
  /** end_date первой подписки (ISO). */
  endDate?: string | null;
  /** Пробный период — статус-чип вместо «Активна». */
  isTrial?: boolean;
  balanceRubles: number;
  /** Заработано с рефералов, ₽ — чип под балансом. 0/null — чип скрыт. */
  fromFriendsRubles?: number | null;
  loading?: boolean;
  /** Куда ведёт карточка закончившейся подписки (продление конкретной). */
  renewTo?: string;
}

function formatUntil(endDate: string, locale: string): string {
  const lang = (locale || 'ru').split('-')[0];
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(date);
  }
}

export default function InfoCards({
  status,
  daysLeft,
  endDate,
  isTrial,
  balanceRubles,
  fromFriendsRubles,
  loading,
  renewTo = '/subscriptions',
}: InfoCardsProps) {
  const { t, i18n } = useTranslation();

  const endingSoon = status === 'active' && daysLeft != null && daysLeft <= 3;
  const subChip =
    status === 'expired'
      ? { label: t('dashboard.info.subscription.renew', 'Продлить'), tone: 'danger' }
      : status === 'none'
        ? { label: t('dashboard.info.subscription.chooseTariff', 'Выберите тариф'), tone: 'warn' }
        : isTrial
          ? {
              label: t('dashboard.info.subscription.trial', 'Пробный период'),
              tone: endingSoon ? 'warn' : 'accent',
            }
          : endingSoon
            ? {
                label: t('dashboard.info.subscription.endingSoon', 'Скоро закончится'),
                tone: 'warn',
              }
            : { label: t('dashboard.info.subscription.active', 'Активна'), tone: 'success' };

  const chipClass =
    subChip.tone === 'success'
      ? 'border-success-500/25 bg-success-500/10 text-success-400'
      : subChip.tone === 'danger'
        ? 'border-error-500/25 bg-error-500/10 text-error-400'
        : subChip.tone === 'accent'
          ? 'border-accent-500/30 bg-accent-500/10 text-accent-300'
          : 'border-warning-500/25 bg-warning-500/10 text-warning-400';

  const hasSubscription = status !== 'none';

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Подписка */}
      <Link
        to={
          status === 'expired'
            ? renewTo
            : hasSubscription
              ? '/subscription'
              : '/subscription/purchase'
        }
        className="bento-card-hover group flex min-h-[118px] flex-col justify-between p-4"
      >
        <span className="text-sm font-medium text-dark-400">
          {t('dashboard.info.subscription.title', 'Подписка')}
        </span>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-16" />
        ) : status === 'active' && daysLeft != null ? (
          <span className="mt-1 block">
            <span className="block text-[26px] font-bold leading-none tracking-tight text-dark-50">
              {t('dashboard.info.subscription.daysCount', { count: daysLeft })}
            </span>
            {endDate && (
              <span className="mt-1 block text-xs text-dark-400">
                {t('dashboard.info.subscription.until', 'до {{date}}', {
                  date: formatUntil(endDate, i18n.language),
                })}
              </span>
            )}
          </span>
        ) : (
          <span className="mt-1 block">
            <span className="block whitespace-nowrap text-[22px] font-bold leading-none tracking-tight text-dark-50">
              {status === 'expired'
                ? t('dashboard.info.subscription.expired', 'Закончилась')
                : t('dashboard.info.subscription.none', 'Нет подписки')}
            </span>
            {status === 'expired' && endDate && (
              <span className="mt-1 block text-xs text-dark-400">
                {formatUntil(endDate, i18n.language)}
              </span>
            )}
          </span>
        )}
        <span
          className={`mt-2 inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-2xs font-semibold ${chipClass}`}
        >
          {subChip.label}
        </span>
      </Link>

      {/* Баланс */}
      <Link
        to="/balance"
        className="bento-card-hover group flex min-h-[118px] flex-col justify-between p-4"
      >
        <span className="text-sm font-medium text-dark-400">
          {t('dashboard.info.balance.title', 'Баланс')}
        </span>
        <span className="mt-1 block">
          <span className="block text-[26px] font-bold leading-none tracking-tight text-dark-50">
            {Math.floor(balanceRubles).toLocaleString('ru-RU')}
            {'\u00A0'}₽
          </span>
          <span className="mt-1 block text-xs text-dark-400">
            {t('dashboard.info.balance.renewals', 'Оплата продлений')}
          </span>
        </span>
        {fromFriendsRubles != null && fromFriendsRubles > 0 ? (
          <span className="mt-2 inline-flex w-fit items-center rounded-full border border-accent-500/30 bg-accent-500/10 px-2.5 py-1 text-2xs font-semibold text-accent-300">
            {t('dashboard.info.balance.fromFriends', '+{{amount}}\u00A0₽ с друзей', {
              amount: Math.floor(fromFriendsRubles).toLocaleString('ru-RU'),
            })}
          </span>
        ) : (
          <span className="mt-2" />
        )}
      </Link>
    </div>
  );
}
