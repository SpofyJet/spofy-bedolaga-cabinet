import { Link } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { TONE_CHIP } from '@/components/spofy/tones';
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
  /** Вечная подписка: вместо дней и даты — «Навсегда», «скоро закончится» не бывает. */
  isLifetime?: boolean;
  /** Название тарифа: у вечной подписки крупно показывается оно, а «навсегда» — подписью. */
  tariffName?: string | null;
  /** undefined — баланс ещё грузится (заглушка вместо «0 ₽»). */
  balanceRubles?: number;
  /**
   * Часть баланса, заработанная на друзьях, ₽ (available_balance с бэкенда).
   * Чип «из них N ₽ с друзей» — только когда это ≥ 1 ₽ уже лежащего на балансе.
   */
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
  isLifetime = false,
  tariffName,
  balanceRubles,
  fromFriendsRubles,
  loading,
  renewTo = '/subscriptions',
}: InfoCardsProps) {
  const { t, i18n } = useTranslation();

  const endingSoon = status === 'active' && !isLifetime && daysLeft != null && daysLeft <= 3;
  // Закончилась / нет подписки: чипа нет.
  const subChip =
    status === 'expired' || status === 'none'
      ? null
      : isTrial
        ? {
            label: t('dashboard.info.subscription.trial', 'Пробный период'),
            // Пробный — фиолетовый, как на странице подписки (синий — только действия).
            tone: endingSoon ? 'warn' : 'trial',
          }
        : endingSoon
          ? {
              label: t('dashboard.info.subscription.endingSoon', 'Скоро закончится'),
              tone: 'warn',
            }
          : { label: t('dashboard.info.subscription.active', 'Активна'), tone: 'success' };

  const chipClass =
    subChip?.tone === 'success'
      ? 'bg-success-500/10 text-success-400'
      : subChip?.tone === 'trial'
        ? TONE_CHIP.promo
        : 'bg-warning-500/10 text-warning-400';

  // Доля «с друзей» не может быть больше самого баланса (потратил — её нет),
  // а «+0 ₽» или копейки ничего не сообщают.
  const fromFriends =
    balanceRubles !== undefined && fromFriendsRubles != null
      ? Math.floor(Math.min(fromFriendsRubles, balanceRubles))
      : 0;

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
        className="on-primary rounded-3xl bg-dark-900/70 cursor-pointer transition-colors hover:bg-dark-800/50 active:bg-dark-800/70 group flex min-h-[118px] flex-col justify-between p-4"
      >
        <span className="text-sm font-medium text-dark-400">
          {t('dashboard.info.subscription.title', 'Подписка')}
        </span>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-16" />
        ) : status === 'active' && isLifetime ? (
          <span className="mt-1 block min-w-0">
            <span className="block truncate font-display text-[22px] font-bold leading-tight tracking-tight text-dark-50">
              {tariffName || t('subscription.lifetime.forever')}
            </span>
            {tariffName && (
              <span className="mt-1 block text-xs text-dark-400">
                ∞ {t('subscription.lifetime.forever').toLowerCase()}
              </span>
            )}
          </span>
        ) : status === 'active' && daysLeft != null ? (
          <span className="mt-1 block">
            <span className="block font-display text-[26px] font-bold leading-none tracking-tight text-dark-50">
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
            {/* «Закончилась» в узком окне Telegram (~340 px) не влезала в карточку
                при 22 px: слово, а не число — 18 px по шкале (11.11), влезает от 320 px. */}
            <span
              className={`block whitespace-nowrap font-display text-lg font-bold leading-[26px] tracking-tight ${
                status === 'expired' ? 'text-error-400' : 'text-dark-50'
              }`}
            >
              {status === 'expired'
                ? t('dashboard.info.subscription.expired', 'Закончилась')
                : t('dashboard.info.subscription.none', 'Нет подписки')}
            </span>
            {status === 'expired' && endDate && !isLifetime && (
              <span className="mt-1 block text-xs text-dark-400">
                {formatUntil(endDate, i18n.language)}
              </span>
            )}
          </span>
        )}
        {loading ? (
          <Skeleton className="mt-2 h-6 w-20 rounded-full" />
        ) : subChip ? (
          <span
            className={`mt-2 inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-1 text-2xs min-[380px]:px-2.5 font-semibold ${chipClass}`}
          >
            {subChip.label}
          </span>
        ) : (
          <span className="mt-2" />
        )}
      </Link>

      {/* Баланс */}
      <Link
        to="/balance"
        className="rounded-3xl bg-dark-900/70 cursor-pointer transition-colors hover:bg-dark-800/50 active:bg-dark-800/70 group flex min-h-[118px] flex-col justify-between p-4"
      >
        <span className="text-sm font-medium text-dark-400">
          {t('dashboard.info.balance.title', 'Баланс')}
        </span>
        <span className="mt-1 block">
          {balanceRubles === undefined ? (
            <Skeleton className="h-[26px] w-20" />
          ) : (
            <span className="block font-display text-[26px] font-bold leading-none tracking-tight text-dark-50">
              {Math.floor(balanceRubles).toLocaleString('ru-RU')}
              {'\u00A0'}₽
            </span>
          )}
          <span className="mt-1 block text-xs text-dark-400">
            {t('dashboard.info.balance.renewals', 'Оплата продлений')}
          </span>
        </span>
        {fromFriends >= 1 ? (
          <span
            className={`mt-2 inline-flex w-fit items-center rounded-xl px-2.5 py-1 text-2xs font-semibold ${TONE_CHIP.friends}`}
          >
            {t('dashboard.info.balance.fromFriends', {
              amount: fromFriends.toLocaleString('ru-RU'),
            })}
          </span>
        ) : (
          <span className="mt-2" />
        )}
      </Link>
    </div>
  );
}
