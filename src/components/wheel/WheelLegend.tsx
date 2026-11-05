import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WheelPrize } from '../../api/wheel';
import { cn } from '@/lib/utils';
import { PrizeGlyph } from './PrizeGlyph';
import { prizeDescription, prizeTitle, type PrizeTextContext } from './prizeText';

interface WheelLegendProps {
  prizes: WheelPrize[];
  context?: PrizeTextContext;
}

const RARITY_STYLE: Record<string, string> = {
  common: 'bg-dark-800 text-dark-300',
  rare: 'bg-accent-500/15 text-accent-300',
  jackpot: 'bg-cta-500 text-on-cta',
};

/** Витрина «Что может выпасть»: плитки призов в цвете их сектора. */
const WheelLegend = memo(function WheelLegend({ prizes, context }: WheelLegendProps) {
  const { t } = useTranslation();

  // Джекпот и редкие — первыми: на них и смотрят.
  const order = { jackpot: 0, rare: 1, common: 2 } as Record<string, number>;
  const sorted = [...prizes].sort(
    (a, b) => (order[a.rarity ?? ''] ?? 3) - (order[b.rarity ?? ''] ?? 3),
  );

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {sorted.map((prize, index) => {
        return (
          <div
            key={prize.id}
            className={cn(
              'relative flex min-h-[132px] flex-col gap-2 overflow-hidden rounded-3xl bg-dark-900/70 p-3.5',
              // Нечётное число призов — последняя плитка на всю ширину, без дырки в сетке.
              sorted.length % 2 === 1 && index === sorted.length - 1 && 'col-span-2 min-h-[96px]',
            )}
          >
            <div className="relative flex items-start justify-between gap-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-500/15 text-[22px] text-accent-400">
                <PrizeGlyph
                  type={prize.prize_type}
                  rarity={prize.rarity}
                  emoji={prize.emoji}
                  className="h-6 w-6"
                />
              </span>
              {prize.rarity && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[13px] font-semibold',
                    RARITY_STYLE[prize.rarity],
                  )}
                >
                  {t(`wheel.rarity.${prize.rarity}`)}
                </span>
              )}
            </div>
            <div className="relative mt-auto min-w-0">
              <div className="text-[17px] font-bold leading-tight text-dark-50">
                {prizeTitle(prize, t)}
              </div>
              <div className="mt-0.5 text-[13px] leading-snug text-dark-400">
                {prizeDescription(prize, t, context)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default WheelLegend;
