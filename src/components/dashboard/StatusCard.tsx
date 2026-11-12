import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatLiteDate } from '@/utils/liteDate';
import { trafficPair } from './DevicesTrafficCard';
import { StatusShield, type StatusTone } from './StatusShield';

/**
 * Главная карточка главной (12.11): один взгляд — работает ли VPN, одна кнопка —
 * что сейчас сделать, ниже строки с остальным: устройства, трафик, подписка,
 * баланс. Каждая строка нажимается целиком: сама строка ведёт к подробностям,
 * надпись справа — к действию.
 *
 * Заменила ряд из четырёх быстрых действий и карточки «Подписка», «Баланс»,
 * «Устройства и трафик»: главная кнопка стояла плиткой 80 px среди трёх таких
 * же и получала 9 % внимания, теперь она одна на всю ширину (35 %).
 *
 * Кнопка по состоянию:
 *   оплачено            → Подключить устройство
 *   ≤ 3 дней до конца   → Продлить
 *   закончилась         → Продлить и включить VPN
 *   пробный, подключён  → Оформить подписку
 *   пробный, пусто      → Подключить устройство
 *   трафик закончился   → Докупить трафик (пробному — Оформить подписку)
 *   подписки нет        → Тарифы и цены
 */
export type StatusCardState = 'active' | 'expired' | 'none';

export interface StatusCardProps {
  /** Состояние доступа ещё не известно: заглушка того же размера. */
  loading?: boolean;
  state: StatusCardState;
  subscriptionId?: number;
  /** ISO-дата конца подписки. */
  endDate?: string | null;
  /** Дней до конца (округление вверх), как считает главная. */
  daysLeft?: number;
  trial?: boolean;
  lifetime?: boolean;
  /** Трафик закончился: подписка ограничена до докупки. */
  limited?: boolean;
  /** Старая подписка без тарифа: «Продлить» у неё означает выбрать тариф. */
  needsTariff?: boolean;
  tariffName?: string | null;
  connectTo: string;
  renewTo: string;
  /** Сколько устройств подключено; undefined — ещё не известно (строки нет). */
  connectedDevices?: number;
  /** 0 — без ограничения. */
  deviceLimit?: number;
  /** Лимит трафика, ГБ; 0 — без ограничения (строки нет). */
  trafficLimitGb?: number;
  trafficUsedGb?: number;
  /** Лимит считается только на серверах обходов. */
  bypassQuota?: boolean;
  /** Квота обходов исчерпана: обходы выключены, обычные серверы работают. */
  bypassSuspended?: boolean;
  /** undefined — баланс ещё грузится. */
  balanceRubles?: number;
  /** Часть баланса, заработанная на друзьях, ₽. */
  fromFriendsRubles?: number | null;
  /** Над карточкой уже стоит главная кнопка (пробный период): здесь кнопка спокойная. */
  quietAction?: boolean;
}

/** Сколько календарных дней до даты: 0 — сегодня, 1 — завтра. */
export function calendarDaysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(end) - startOfDay(new Date())) / 86_400_000);
}

interface RowProps {
  label: string;
  value: ReactNode;
  /** Подпись рядом со значением. */
  hint?: ReactNode;
  hintWarn?: boolean;
  /** Надпись действия справа и куда оно ведёт. */
  action?: string;
  to?: string;
  /** Куда ведёт сама строка, если не туда же, что действие (подписка, баланс). */
  detailsTo?: string;
  children?: ReactNode;
  testId: string;
}

const ROW_FRAME = 'border-t border-dark-600/30';
const ROW_PRESS = 'transition-opacity hover:opacity-80 active:opacity-70';

/**
 * Строка карточки нажимается целиком. Если у строки есть и подробности, и
 * действие (подписка: страница подписки и «Продлить»), это две ссылки рядом:
 * слева — подробности, справа — действие.
 */
function Row({ label, value, hint, hintWarn, action, to, detailsTo, children, testId }: RowProps) {
  const main = (
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-medium text-dark-400">{label}</span>
      <span className="mt-0.5 block text-base font-semibold text-dark-50">
        {value}
        {hint ? (
          <span
            className={cn(
              'ml-1.5 text-sm font-medium',
              hintWarn ? 'text-warning-400' : 'text-dark-400',
            )}
          >
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </span>
  );
  const hasAction = Boolean(action && to);
  const actionLabel = hasAction ? (
    <span className="shrink-0 text-[15px] font-semibold text-accent-400">{action}</span>
  ) : null;
  const bodyTo = detailsTo ?? (hasAction ? to : undefined);

  if (!bodyTo) {
    return (
      <div data-status-row={testId} className={cn(ROW_FRAME, 'flex items-center py-[13px]')}>
        {main}
      </div>
    );
  }
  if (!hasAction || bodyTo === to) {
    return (
      <Link
        to={bodyTo}
        data-status-row={testId}
        className={cn(ROW_FRAME, ROW_PRESS, 'flex items-center gap-3 py-[13px]')}
      >
        {main}
        {actionLabel}
      </Link>
    );
  }
  return (
    <div data-status-row={testId} className={cn(ROW_FRAME, 'flex items-stretch')}>
      <Link to={bodyTo} className={cn(ROW_PRESS, 'flex min-w-0 flex-1 items-center py-[13px]')}>
        {main}
      </Link>
      <Link to={to as string} className={cn(ROW_PRESS, 'flex shrink-0 items-center pl-4')}>
        {actionLabel}
      </Link>
    </div>
  );
}

function TrafficBar({ percent, warn }: { percent: number; warn: boolean }) {
  return (
    <span
      className="mt-2 block h-1 overflow-hidden rounded-full bg-dark-600/40"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <span
        className={cn('block h-full rounded-full', warn ? 'bg-warning-400' : 'bg-accent-400')}
        style={{ width: `${Math.max(percent, percent > 0 ? 3 : 0)}%` }}
      />
    </span>
  );
}

export default function StatusCard({
  loading = false,
  state,
  subscriptionId,
  endDate,
  daysLeft,
  trial = false,
  lifetime = false,
  limited = false,
  needsTariff = false,
  tariffName,
  connectTo,
  renewTo,
  connectedDevices,
  deviceLimit = 0,
  trafficLimitGb = 0,
  trafficUsedGb = 0,
  bypassQuota = false,
  bypassSuspended = false,
  balanceRubles,
  fromFriendsRubles,
  quietAction = false,
}: StatusCardProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <section className="rounded-3xl bg-dark-900/70 p-[18px]" aria-busy="true">
        <div className="flex items-center gap-3.5 pb-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-[52px] w-full rounded-2xl" />
        <Skeleton className="mt-5 h-10 w-full rounded-xl" />
        <Skeleton className="mt-3 h-10 w-full rounded-xl" />
      </section>
    );
  }

  const date = formatLiteDate(endDate);
  const until = calendarDaysUntil(endDate);
  const devicesKnown = connectedDevices !== undefined;
  const endingSoon =
    state === 'active' && !trial && !lifetime && !limited && daysLeft != null && daysLeft <= 3;
  const trialNoDevice = state === 'active' && trial && !limited && connectedDevices === 0;
  const purchaseTo = '/subscription/purchase';

  // Заголовок, подпись, пояснение и главная кнопка — по состоянию.
  let tone: StatusTone;
  let title: string;
  let caption = '';
  let note: string | null = null;
  let action: { label: string; to: string };

  if (state === 'none') {
    tone = 'idle';
    title = t('dashboard.info.subscription.none', 'Нет подписки');
    action = { label: t('subscriptions.browsePlans', 'Тарифы и цены'), to: purchaseTo };
  } else if (state === 'expired') {
    tone = 'off';
    title = t('dashboard.vpn.off', 'VPN выключен');
    // Подписку могли отключить и до конца оплаченного срока: «закончилась» про будущую дату — неправда.
    const ended = until === null || until <= 0;
    if (trial) {
      caption = date ? t('dashboard.vpn.trialEnded', { date }) : '';
      note = t('dashboard.vpn.trialExpiredNote');
      action = { label: t('dashboard.vpn.subscribe', 'Оформить подписку'), to: purchaseTo };
    } else {
      caption = date
        ? ended
          ? t('dashboard.vpn.paidEnded', { date })
          : t('dashboard.vpn.paidUntil', { date })
        : '';
      note = t('dashboard.vpn.expiredNote');
      action = {
        label: t('dashboard.vpn.renewAndEnable', 'Продлить и включить VPN'),
        to: renewTo,
      };
    }
  } else if (limited) {
    tone = 'warn';
    title = t('subscription.trafficLimitedTitle', 'Трафик закончился');
    caption = date
      ? trial
        ? t('dashboard.vpn.trialUntil', { date })
        : t('dashboard.vpn.paidUntil', { date })
      : '';
    action =
      trial || subscriptionId == null
        ? { label: t('dashboard.vpn.subscribe', 'Оформить подписку'), to: purchaseTo }
        : {
            label: t('subscription.buyTraffic', 'Докупить трафик'),
            to: `/subscriptions/${subscriptionId}?topup=traffic`,
          };
  } else if (trial) {
    tone = 'ok';
    if (trialNoDevice) {
      title = t('dashboard.vpn.trialRunning', 'Пробный период идёт');
      caption = date ? t('dashboard.vpn.trialNoDevice', { date }) : '';
      action = { label: t('dashboard.vpn.connect', 'Подключить устройство'), to: connectTo };
    } else {
      title = t('dashboard.vpn.working', 'VPN работает');
      caption = date ? t('dashboard.vpn.trialUntil', { date }) : '';
      // Сколько устройств подключено, неизвестно: зовём подключить — это верно для всех.
      action = devicesKnown
        ? { label: t('dashboard.vpn.subscribe', 'Оформить подписку'), to: purchaseTo }
        : { label: t('dashboard.vpn.connect', 'Подключить устройство'), to: connectTo };
    }
  } else if (endingSoon) {
    tone = 'warn';
    title =
      until !== null && until <= 0
        ? t('dashboard.vpn.endsToday', 'VPN выключится сегодня')
        : until === 1
          ? t('dashboard.vpn.endsTomorrow', 'VPN выключится завтра')
          : t('dashboard.vpn.endsIn', { count: until ?? daysLeft ?? 0 });
    caption = date ? t('dashboard.vpn.paidUntil', { date }) : '';
    note = t('dashboard.vpn.renewNote');
    action = { label: t('dashboard.vpn.renew', 'Продлить'), to: renewTo };
  } else {
    tone = 'ok';
    title = t('dashboard.vpn.working', 'VPN работает');
    caption = lifetime
      ? t('subscription.lifetime.forever', 'Навсегда').toLowerCase()
      : date && daysLeft != null
        ? t('dashboard.vpn.untilLeft', {
            date,
            left: t('dashboard.info.subscription.daysCount', { count: daysLeft }),
          })
        : '';
    action = { label: t('dashboard.vpn.connect', 'Подключить устройство'), to: connectTo };
  }

  // Строки под кнопкой. Действие, которое уже стоит на главной кнопке, в строках не повторяем.
  const hasAccess = state === 'active';
  const unlimitedDevices = deviceLimit <= 0;
  const atDeviceLimit =
    devicesKnown && !unlimitedDevices && (connectedDevices as number) >= deviceLimit;
  // У пробного без устройств об этом уже сказано в подписи под заголовком.
  const showDevices = hasAccess && devicesKnown && !trialNoDevice;
  const showTraffic = hasAccess && trafficLimitGb > 0;
  const trafficPercent = showTraffic
    ? Math.min(100, Math.max(0, (trafficUsedGb / trafficLimitGb) * 100))
    : 0;
  const trafficWarn = bypassSuspended || limited || trafficPercent >= 85;
  const traffic = showTraffic ? trafficPair(trafficUsedGb, trafficLimitGb) : null;
  const canBuyTraffic = !trial && subscriptionId != null && !limited;
  const showSubscription = hasAccess && !trial && !endingSoon;
  const fromFriends =
    balanceRubles !== undefined && fromFriendsRubles != null
      ? Math.floor(Math.min(fromFriendsRubles, balanceRubles))
      : 0;

  return (
    <section className="rounded-3xl bg-dark-900/70 p-[18px] pb-1.5" data-status-card={state}>
      <div className="flex items-center gap-3.5 pb-4">
        <StatusShield tone={tone} />
        <div className="min-w-0">
          <h2 className="font-display text-[22px] font-bold leading-[1.15] tracking-[-0.01em] text-dark-50">
            {title}
          </h2>
          {caption ? <p className="mt-[3px] text-sm text-dark-400">{caption}</p> : null}
        </div>
      </div>

      {note ? <p className="pb-3.5 text-sm leading-[1.45] text-dark-400">{note}</p> : null}

      <Link
        to={action.to}
        data-status-action
        className={cn(
          'mt-1.5 flex h-[52px] w-full items-center justify-center rounded-2xl px-4 text-base font-semibold transition-colors active:scale-[0.98]',
          quietAction
            ? 'bg-dark-800/70 text-dark-100 hover:bg-dark-700/70'
            : 'bg-cta-500 text-on-cta hover:bg-cta-600',
        )}
      >
        {action.label}
      </Link>

      <div className="mt-3.5">
        {showDevices && (
          <Row
            testId="devices"
            label={t('dashboard.vpn.devices', 'Устройства')}
            value={
              unlimitedDevices
                ? connectedDevices
                : t('dashboard.devicesTraffic.ofDevices', '{{used}} из {{limit}}', {
                    used: connectedDevices,
                    limit: deviceLimit,
                  })
            }
            hint={
              atDeviceLimit
                ? t('dashboard.devicesTraffic.allSlotsBusy', 'все места заняты')
                : t('dashboard.vpn.connected', 'подключено')
            }
            hintWarn={atDeviceLimit}
            action={
              (connectedDevices as number) > 0 ? t('dashboard.vpn.manage', 'Управлять') : undefined
            }
            to="/subscription?section=devices"
            detailsTo="/subscription?section=devices"
          />
        )}

        {traffic && (
          <Row
            testId="traffic"
            label={
              bypassQuota
                ? t('dashboard.vpn.bypassTraffic', 'Трафик обходов')
                : t('dashboard.vpn.traffic', 'Трафик')
            }
            value={t('dashboard.devicesTraffic.ofTraffic', '{{used}} из {{limit}}', traffic)}
            hint={
              bypassSuspended
                ? t('dashboard.devicesTraffic.bypassOff', 'обходы выключены')
                : undefined
            }
            hintWarn
            action={canBuyTraffic ? t('dashboard.vpn.buyMore', 'Докупить') : undefined}
            to={`/subscriptions/${subscriptionId}?topup=traffic`}
          >
            <TrafficBar percent={trafficPercent} warn={trafficWarn} />
            {bypassSuspended && (
              <span className="mt-2 block text-[13px] leading-snug text-dark-400">
                {t(
                  'dashboard.devicesTraffic.bypassOffHint',
                  'Обычные серверы работают. Чтобы вернуть обходы, докупите гигабайты.',
                )}
              </span>
            )}
          </Row>
        )}

        {showSubscription && (
          <Row
            testId="subscription"
            label={t('dashboard.vpn.subscription', 'Подписка')}
            value={
              needsTariff
                ? t('subscription.legacy.noTariff')
                : tariffName || t('subscription.defaultName', 'Подписка')
            }
            action={
              lifetime
                ? undefined
                : needsTariff
                  ? t('subscription.chooseTariff', 'Выбрать тариф')
                  : t('dashboard.vpn.renew', 'Продлить')
            }
            to={renewTo}
            detailsTo="/subscription"
          />
        )}

        <Row
          testId="balance"
          label={t('dashboard.vpn.balance', 'Баланс')}
          value={
            balanceRubles === undefined ? (
              <Skeleton className="inline-block h-5 w-16 align-middle" />
            ) : (
              `${Math.floor(balanceRubles).toLocaleString('ru-RU')} ₽`
            )
          }
          hint={
            fromFriends >= 1
              ? t('dashboard.info.balance.fromFriends', {
                  amount: fromFriends.toLocaleString('ru-RU'),
                })
              : undefined
          }
          action={t('dashboard.vpn.topUp', 'Пополнить')}
          to="/balance/top-up"
          detailsTo="/balance"
        />
      </div>
    </section>
  );
}
