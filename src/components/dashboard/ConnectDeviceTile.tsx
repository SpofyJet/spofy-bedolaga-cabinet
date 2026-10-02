import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useHaptic } from '../../platform';
import { ChevronRightIcon, MonitorIcon } from '@/components/icons';

/** До скольких устройств лимит показываем точками. */
const DOTS_MAX = 5;

interface ConnectDeviceTileProps {
  subscription: {
    id: number;
    device_limit: number;
    subscription_url?: string | null;
  };
  connectedDevices: number;
  /** Оставлен для совместимости вызовов; цвет плитки от трафика больше не зависит. */
  usedPercent?: number;
}

/**
 * Плитка «Подключить устройство» — главное действие карточки подписки.
 *
 * Живёт и в карточке активной подписки, и на главной: пользователь,
 * которому подписку выдал бонус рекламной кампании, попадает на главную
 * с готовым доступом — и без этой плитки не понимает, что делать дальше.
 * Счётчик устройств — текстом: точки и полоска дублировали подпись и
 * отнимали место у заголовка на узких экранах.
 */
export default function ConnectDeviceTile({
  subscription,
  connectedDevices,
}: ConnectDeviceTileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useHaptic();

  const isAtDeviceLimit =
    subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;

  if (!subscription.subscription_url) return null;

  const devicesLine =
    subscription.device_limit === 0
      ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
      : t('dashboard.devicesOfMax', { used: connectedDevices, max: subscription.device_limit });

  return (
    <button
      type="button"
      onClick={() => {
        if (isAtDeviceLimit) {
          haptic.notification('error');
          return;
        }
        navigate(`/connection?sub=${subscription.id}`);
      }}
      aria-disabled={isAtDeviceLimit}
      className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors ${
        isAtDeviceLimit
          ? 'cursor-not-allowed border-transparent opacity-60'
          : 'border-accent-500/25 bg-accent-500/[0.08] hover:border-accent-500/45 hover:bg-accent-500/[0.12]'
      }`}
      data-onboarding="connect-devices"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-accent-500 text-on-accent">
        <MonitorIcon className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-dark-50">
          {t('dashboard.connectDevice')}
        </span>
        <span className="mt-0.5 block text-[13px] text-dark-400">{devicesLine}</span>
        {isAtDeviceLimit && (
          <span className="mt-1 block text-xs font-medium text-warning-400">
            {t('dashboard.deviceLimitReached')}
          </span>
        )}
      </span>

      {/* До пяти мест — точками: свободные слоты видны быстрее, чем в «2 из 5».
          Больше — только текст: точки съедали место у заголовка. */}
      {subscription.device_limit > 0 && subscription.device_limit <= DOTS_MAX && (
        <span className="flex flex-shrink-0 gap-1" aria-hidden="true">
          {Array.from({ length: subscription.device_limit }, (_, i) => (
            <span
              key={i}
              className={`h-[7px] w-[7px] rounded-full ${
                i < connectedDevices ? 'bg-accent-400' : 'bg-dark-50/15'
              }`}
            />
          ))}
        </span>
      )}

      {!isAtDeviceLimit && (
        <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-accent-400 transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
