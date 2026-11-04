import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PiPlusBold, PiCaretRightBold, PiWarningCircleFill } from 'react-icons/pi';

import { cn } from '@/lib/utils';
import { formatTraffic } from '@/utils/formatTraffic';
import type { Device } from '@/types';
import { platformIcon } from '@/components/subscription/platformIcon';

const PANEL = 'flex min-w-0 flex-col rounded-2xl bg-dark-800/45 p-2.5 min-[360px]:p-3';
const TILE =
  'flex aspect-square w-full max-w-[32px] items-center justify-center rounded-lg min-[360px]:rounded-[10px]';
const VALUE =
  'mt-3 truncate text-base font-bold leading-tight tracking-tight text-dark-50 min-[360px]:text-lg';
const CAPTION = 'mt-0.5 text-xs leading-snug';
const ACTION =
  'mt-3 flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-[13px] font-semibold transition-colors min-[360px]:text-sm';
const ACTION_HOT = 'bg-accent-500 text-on-accent hover:bg-accent-600';
const ACTION_QUIET = 'bg-dark-700/60 text-dark-100 hover:bg-dark-700';

/** Сколько плиток помещается в половину карточки на телефоне (4 × 32px + зазоры). */
const MAX_TILES = 4;

type Tile =
  | { kind: 'device'; device?: Device }
  | { kind: 'more'; count: number }
  | { kind: 'free' };

/**
 * Плитки устройств — не больше четырёх, чтобы ряд не налезал на колонку трафика:
 * подключённые (иконкой платформы), «+N» — ещё N подключённых, которые не
 * влезли, и пунктир — свободное место. Свободному месту, если оно есть, всегда
 * достаётся последняя плитка: по ряду видно и «сколько подключено», и «есть ли
 * куда ещё». Точное «8 из 9» — строкой ниже.
 */
export function deviceTiles(connected: number, limit: number, devices: Device[]): Tile[] {
  const free = limit > 0 ? Math.max(0, limit - connected) : 0;
  const forDevices = MAX_TILES - (free > 0 ? 1 : 0);
  const tiles: Tile[] = [];
  if (connected > forDevices) {
    for (let i = 0; i < forDevices - 1; i++) tiles.push({ kind: 'device', device: devices[i] });
    tiles.push({ kind: 'more', count: connected - (forDevices - 1) });
  } else {
    for (let i = 0; i < connected; i++) tiles.push({ kind: 'device', device: devices[i] });
  }
  const freeTiles = Math.min(free, MAX_TILES - tiles.length);
  for (let i = 0; i < freeTiles; i++) tiles.push({ kind: 'free' });
  return tiles;
}

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
  const tiles = deviceTiles(connectedDevices, deviceLimit, devices);
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
    <section
      className="rounded-3xl bg-dark-900/70 ring-1 ring-inset ring-dark-800/80 p-4"
      aria-label={t('dashboard.devicesTraffic.title')}
    >
      <Link to="/subscription" className="group mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight text-dark-50">
          {t('dashboard.devicesTraffic.title')}
        </h2>
        <PiCaretRightBold className="h-4 w-4 text-dark-500 transition-transform group-hover:translate-x-0.5 group-hover:text-dark-300" />
      </Link>

      {/* Две панели вместо линии-разделителя: у каждой своя подложка и своя
          кнопка внутри — видно, что к чему относится, и на узком экране
          колонкам не нужно ничего делить. */}
      <div className="grid grid-cols-2 gap-2">
        {/* Устройства: верх панели ведёт в «Мои устройства», кнопка — докупить место */}
        <div className={PANEL}>
          <Link
            to="/subscription?section=devices"
            aria-label={t('dashboard.devicesTraffic.manage', 'Мои устройства')}
            className="-m-1 block rounded-xl p-1 transition-opacity hover:opacity-80"
          >
            {/* Плитки резиновые: четыре колонки по ширине панели, но не больше
                32px — на узком экране Telegram ряд не вылезает за панель. */}
            <div
              className="grid h-8 max-w-[146px] grid-cols-4 items-center gap-1 min-[360px]:gap-1.5"
              aria-hidden
            >
              {tiles.map((tile, i) => {
                if (tile.kind === 'free')
                  return (
                    <span key={i} className={cn(TILE, 'border border-dashed border-dark-600/70')} />
                  );
                if (tile.kind === 'more')
                  return (
                    <span
                      key={i}
                      className={cn(TILE, 'bg-accent-500/15 text-[11px] font-bold text-accent-300')}
                    >
                      +{tile.count}
                    </span>
                  );
                const Icon = platformIcon(tile.device?.platform);
                return (
                  <span key={i} className={cn(TILE, 'bg-accent-500/15 text-accent-300')}>
                    <Icon className="h-4 w-4" />
                  </span>
                );
              })}
            </div>
            <div className={VALUE}>
              {unlimitedDevices
                ? connectedDevices
                : t('dashboard.devicesTraffic.ofDevices', '{{used}} из {{limit}}', {
                    used: connectedDevices,
                    limit: deviceLimit,
                  })}
            </div>
            <div className={cn(CAPTION, atLimit ? 'text-warning-400' : 'text-dark-400')}>
              {atLimit
                ? t('dashboard.devicesTraffic.allSlotsBusy', 'все места заняты')
                : t('dashboard.devicesTraffic.devices', 'устройств подключено')}
            </div>
          </Link>
          <span className="flex-1" aria-hidden />
          <Link to={devicesTo} className={cn(ACTION, atLimit ? ACTION_HOT : ACTION_QUIET)}>
            <PiPlusBold className="hidden h-3.5 w-3.5 shrink-0 min-[360px]:block" />
            {/* на узком экране — короткая подпись: панель и так про устройства */}
            <span className="hidden min-[360px]:inline">
              {t('dashboard.devicesTraffic.addSlot', 'Добавить место')}
            </span>
            <span className="min-[360px]:hidden">
              {t('dashboard.devicesTraffic.addSlotShort', 'Ещё место')}
            </span>
          </Link>
        </div>

        {/* Трафик. Безлимиту докупать нечего — кнопки нет, и панель не тянет
            пустоту снизу: значок и подпись стоят по центру. */}
        <div className={cn(PANEL, unlimitedTraffic && 'items-center justify-center text-center')}>
          <div className="flex h-8 items-center">
            {unlimitedTraffic ? (
              // та же плитка, что у устройств: ряды двух панелей на одной высоте
              <span
                className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent-500/15 text-lg font-bold leading-none text-accent-300"
                aria-hidden
              >
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
          <div className={VALUE}>
            {unlimitedTraffic
              ? t('dashboard.devicesTraffic.noLimit', 'Без лимита')
              : t('dashboard.devicesTraffic.ofTraffic', '{{used}} из {{limit}}', {
                  ...trafficPair(trafficUsedGb, trafficLimitGb),
                })}
          </div>
          <div className={cn(CAPTION, bypassSuspended ? 'text-warning-400' : 'text-dark-400')}>
            {bypassSuspended
              ? t('dashboard.devicesTraffic.bypassOff', 'обходы выключены')
              : bypassQuota
                ? t('dashboard.devicesTraffic.bypassTraffic', 'трафик обходов')
                : t('dashboard.devicesTraffic.traffic', 'трафик')}
          </div>
          {!unlimitedTraffic && <span className="flex-1" aria-hidden />}
          {!unlimitedTraffic && (
            <Link to={trafficTo} className={cn(ACTION, trafficLow ? ACTION_HOT : ACTION_QUIET)}>
              <PiPlusBold className="hidden h-3.5 w-3.5 shrink-0 min-[360px]:block" />
              {t('dashboard.devicesTraffic.buyTraffic', 'Докупить ГБ')}
            </Link>
          )}
        </div>
      </div>

      {bypassSuspended && (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-warning-500/10 px-3 py-2 text-xs leading-relaxed text-warning-300">
          <PiWarningCircleFill className="mt-px h-4 w-4 shrink-0" />
          {t(
            'dashboard.devicesTraffic.bypassOffHint',
            'Обычные серверы работают. Чтобы вернуть обходы, докупите гигабайты.',
          )}
        </p>
      )}
    </section>
  );
}
