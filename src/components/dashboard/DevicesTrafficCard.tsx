import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  PiDeviceMobileFill,
  PiLaptopFill,
  PiMonitorFill,
  PiTelevisionFill,
  PiPlusBold,
  PiCaretRightBold,
  PiWarningCircleFill,
} from 'react-icons/pi';
import type { IconType } from 'react-icons';

import { cn } from '@/lib/utils';
import { formatTraffic } from '@/utils/formatTraffic';
import type { Device } from '@/types';

/** Сколько ячеек устройств рисуем; дальше — «+N». */
const MAX_SLOTS = 4;

interface DevicesTrafficCardProps {
  subscriptionId: number;
  isTrial: boolean;
  deviceLimit: number;
  devices: Device[];
  connectedDevices: number;
  /** Лимит трафика, ГБ. 0 — безлимит. */
  trafficLimitGb: number;
  trafficUsedGb: number;
  /** Spofy: лимит считается только на серверах обходов, обычные — без лимита. */
  bypassQuota?: boolean;
  /** Spofy: квота обходов исчерпана — обходы выключены, обычные серверы работают. */
  bypassSuspended?: boolean;
}

function platformIcon(platform: string | undefined): IconType {
  const p = (platform || '').toLowerCase();
  if (/tv|android ?tv|tizen|webos|apple ?tv/.test(p)) return PiTelevisionFill;
  if (/ios|iphone|ipad|android/.test(p)) return PiDeviceMobileFill;
  if (/mac|windows|linux|desktop/.test(p)) return PiLaptopFill;
  return PiMonitorFill;
}

/** «12,4 из 50 ГБ»: единицу у первого числа опускаем, только если она та же. */
export function trafficPair(usedGb: number, limitGb: number): { used: string; limit: string } {
  const used = formatTraffic(usedGb);
  const limit = formatTraffic(limitGb);
  const unitOf = (s: string) => s.split('\u00A0').pop() ?? '';
  const usedUnit = unitOf(used);
  return {
    used: usedUnit === unitOf(limit) ? used.slice(0, used.length - usedUnit.length - 1) : used,
    limit,
  };
}

/**
 * «Устройства и трафик» — второй уровень главной после карточек «Подписка» и
 * «Баланс»: сколько мест занято и сколько трафика обходов осталось, и по
 * кнопке на каждое «докупить». Без процентов-гигантов, моно-шрифта и
 * дублирования дней (они уже в карточке «Подписка»).
 */
export default function DevicesTrafficCard({
  subscriptionId,
  isTrial,
  deviceLimit,
  devices,
  connectedDevices,
  trafficLimitGb,
  trafficUsedGb,
  bypassQuota,
  bypassSuspended,
}: DevicesTrafficCardProps) {
  const { t } = useTranslation();

  const unlimitedDevices = deviceLimit <= 0;
  const slots = unlimitedDevices
    ? Math.min(connectedDevices, MAX_SLOTS)
    : Math.min(deviceLimit, MAX_SLOTS);
  const extraSlots = unlimitedDevices ? 0 : Math.max(0, deviceLimit - MAX_SLOTS);
  const atLimit = !unlimitedDevices && connectedDevices >= deviceLimit;

  const unlimitedTraffic = trafficLimitGb <= 0;
  const percent = unlimitedTraffic
    ? 0
    : Math.min(100, Math.max(0, (trafficUsedGb / trafficLimitGb) * 100));
  const trafficLow = !unlimitedTraffic && (bypassSuspended || percent >= 85);

  // Пробный период докупок не продаёт — ведём в тарифы.
  const devicesTo = isTrial ? '/subscription/purchase' : `/subscription?topup=devices`;
  const trafficTo = isTrial
    ? '/subscription/purchase'
    : `/subscriptions/${subscriptionId}?topup=traffic`;

  return (
    <section className="bento-card p-4" aria-label={t('dashboard.devicesTraffic.title')}>
      <Link to="/subscription" className="group mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight text-dark-50">
          {t('dashboard.devicesTraffic.title')}
        </h2>
        <PiCaretRightBold className="h-4 w-4 text-dark-500 transition-transform group-hover:translate-x-0.5 group-hover:text-dark-300" />
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {/* Устройства */}
        <div className="flex min-w-0 flex-col">
          <div className="flex h-9 items-center gap-1.5" aria-hidden>
            {Array.from({ length: slots }).map((_, i) => {
              const device = devices[i];
              const filled = i < connectedDevices;
              const Icon = platformIcon(device?.platform);
              return (
                <span
                  key={i}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]',
                    filled
                      ? 'bg-accent-500/15 text-accent-300'
                      : 'border border-dashed border-dark-600/70 text-dark-600',
                  )}
                >
                  {filled ? <Icon className="h-4 w-4" /> : null}
                </span>
              );
            })}
            {extraSlots > 0 && (
              <span className="text-xs font-semibold text-dark-400">+{extraSlots}</span>
            )}
          </div>
          <div className="mt-3 text-lg font-bold leading-tight tracking-tight text-dark-50">
            {unlimitedDevices
              ? connectedDevices
              : t('dashboard.devicesTraffic.ofDevices', '{{used}} из {{limit}}', {
                  used: connectedDevices,
                  limit: deviceLimit,
                })}
          </div>
          <div className={cn('text-xs', atLimit ? 'text-warning-400' : 'text-dark-400')}>
            {atLimit
              ? t('dashboard.devicesTraffic.allSlotsBusy', 'все места заняты')
              : t('dashboard.devicesTraffic.devices', 'устройств подключено')}
          </div>
        </div>

        {/* Трафик */}
        <div className="flex min-w-0 flex-col border-l border-dark-700/50 pl-3">
          <div className="flex h-9 items-center">
            {unlimitedTraffic ? (
              <span className="text-[28px] font-bold leading-none text-accent-300" aria-hidden>
                ∞
              </span>
            ) : (
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-dark-700/70"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-700',
                    trafficLow ? 'bg-warning-400' : 'bg-accent-400',
                  )}
                  style={{ width: `${Math.max(percent, percent > 0 ? 4 : 0)}%` }}
                />
              </div>
            )}
          </div>
          <div className="mt-3 truncate text-lg font-bold leading-tight tracking-tight text-dark-50">
            {unlimitedTraffic
              ? t('dashboard.devicesTraffic.unlimited', 'Безлимит')
              : t('dashboard.devicesTraffic.ofTraffic', '{{used}} из {{limit}}', {
                  ...trafficPair(trafficUsedGb, trafficLimitGb),
                })}
          </div>
          <div className={cn('text-xs', bypassSuspended ? 'text-warning-400' : 'text-dark-400')}>
            {bypassSuspended
              ? t('dashboard.devicesTraffic.bypassOff', 'обходы выключены')
              : bypassQuota
                ? t('dashboard.devicesTraffic.bypassTraffic', 'трафик обходов')
                : t('dashboard.devicesTraffic.traffic', 'трафик')}
          </div>
        </div>
      </div>

      {bypassSuspended && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-500/10 px-3 py-2 text-xs leading-relaxed text-warning-300">
          <PiWarningCircleFill className="mt-px h-4 w-4 shrink-0" />
          {t(
            'dashboard.devicesTraffic.bypassOffHint',
            'Обычные серверы работают. Чтобы вернуть обходы, докупите гигабайты.',
          )}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to={devicesTo}
          className={cn(
            'flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors',
            atLimit
              ? 'bg-accent-500 text-on-accent hover:bg-accent-600'
              : 'bg-dark-800/80 text-dark-100 hover:bg-dark-700/80',
          )}
        >
          <PiPlusBold className="h-3.5 w-3.5" />
          {t('dashboard.devicesTraffic.addSlot', 'Добавить место')}
        </Link>
        {unlimitedTraffic ? (
          <Link
            to={`/connection?sub=${subscriptionId}`}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-dark-800/80 text-sm font-semibold text-dark-100 transition-colors hover:bg-dark-700/80"
          >
            {t('dashboard.devicesTraffic.manage', 'Мои устройства')}
          </Link>
        ) : (
          <Link
            to={trafficTo}
            className={cn(
              'flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors',
              trafficLow
                ? 'bg-accent-500 text-on-accent hover:bg-accent-600'
                : 'bg-dark-800/80 text-dark-100 hover:bg-dark-700/80',
            )}
          >
            <PiPlusBold className="h-3.5 w-3.5" />
            {t('dashboard.devicesTraffic.buyTraffic', 'Докупить ГБ')}
          </Link>
        )}
      </div>
    </section>
  );
}
