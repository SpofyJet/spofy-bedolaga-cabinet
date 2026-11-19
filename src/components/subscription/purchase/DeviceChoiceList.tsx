import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { TariffDeviceOption } from '../../../types';

interface DeviceChoiceListProps {
  options: TariffDeviceOption[];
  selected: number | null;
  onSelect: (devices: number) => void;
  formatPrice: (kopeks: number) => string;
}

export function DeviceChoiceList({
  options,
  selected,
  onSelect,
  formatPrice,
}: DeviceChoiceListProps) {
  const { t } = useTranslation();
  const ordered = [...options.filter((o) => !o.included), ...options.filter((o) => o.included)];

  return (
    <div className="overflow-hidden rounded-3xl bg-dark-900/70">
      {ordered.map((option, index) => {
        const active = option.devices === selected;
        const upsell = !option.included;
        return (
          <button
            key={option.devices}
            type="button"
            aria-pressed={active}
            data-device-option={option.devices}
            onClick={() => onSelect(option.devices)}
            className={cn(
              'flex min-h-[58px] w-full items-center gap-3.5 px-[18px] py-2.5 text-left transition-colors',
              index > 0 && 'border-t border-dark-600/30',
              upsell
                ? active
                  ? 'bg-success-500/25'
                  : 'bg-success-500/10 hover:bg-success-500/15'
                : active
                  ? 'bg-accent-500/15'
                  : 'hover:bg-dark-800/50',
            )}
          >
            <span
              className={cn(
                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
                active
                  ? upsell
                    ? 'bg-success-500'
                    : 'bg-accent-500'
                  : 'ring-[1.6px] ring-inset ring-dark-400/60',
              )}
              aria-hidden
            >
              {active && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 text-base font-semibold',
                upsell ? 'text-dark-50' : 'text-dark-300',
              )}
            >
              {t('subscription.devices', { count: option.devices })}
            </span>
            {upsell && (
              <span className="whitespace-nowrap font-display text-[17px] font-bold tabular-nums text-dark-50">
                {formatPrice(option.price_kopeks)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
