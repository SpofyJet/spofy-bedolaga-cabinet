import { memo } from 'react';
import type { WheelPrize } from '../../api/wheel';

interface WheelLegendProps {
  prizes: WheelPrize[];
}

const WheelLegend = memo(function WheelLegend({ prizes }: WheelLegendProps) {
  // Get sector color (same logic as in FortuneWheel)
  const getSectorColor = (index: number, baseColor?: string) => {
    if (baseColor) return baseColor;
    const colors = [
      '#8B5CF6',
      '#EC4899',
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#6366F1',
      '#14B8A6',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-900/70 ring-1 ring-inset ring-dark-800/80">
      {prizes.map((prize, index) => {
        const color = getSectorColor(index, prize.color);
        return (
          <div key={prize.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
            {/* Emoji в плитке, цвет сектора — точкой в углу плитки */}
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dark-800/80 text-xl">
              {prize.emoji}
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-dark-900"
                style={{ backgroundColor: color }}
              />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-dark-100">
              {prize.display_name}
            </span>
          </div>
        );
      })}
    </div>
  );
});

export default WheelLegend;
