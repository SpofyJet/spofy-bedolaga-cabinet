import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { BestValueBadge, bestValueFrame } from './BestValueBadge';

/**
 * Выбор срока одним списком (12.11): все сроки в одной карточке через линию,
 * выбранный залит. Раньше каждый срок был отдельной карточкой — пять одинаковых
 * плашек подряд читались как пять разных предложений.
 *
 * Один список на продление и на покупку тарифа: человек видит оба экрана
 * в одном сценарии, и срок на них выбирается одинаково.
 */
export interface PeriodListItem {
  /** Срок в днях — ключ строки. */
  days: number;
  label: string;
  /** Отмечен оператором как самый выгодный (или 3 месяца по умолчанию). */
  best?: boolean;
  /** Чип скидки («-25%»), если есть. */
  discount?: ReactNode;
  /** Цена в пересчёте на месяц («248 ₽»); у месяца и короче не показываем — это сама цена. */
  perMonth?: string | null;
  /** Выгода против помесячной оплаты («45 ₽»). */
  saving?: string | null;
  price: string;
  /** Зачёркнутая цена до скидки. */
  original?: string | null;
}

interface PeriodListProps {
  items: PeriodListItem[];
  selectedDays: number | null;
  onSelect: (days: number) => void;
}

export function PeriodList({ items, selectedDays, onSelect }: PeriodListProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-3xl bg-dark-900/70">
      {items.map((item, index) => {
        const selected = item.days === selectedDays;
        return (
          <button
            key={item.days}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(item.days)}
            className={cn(
              'flex min-h-[66px] w-full items-center gap-3.5 px-[18px] py-2.5 text-left transition-colors',
              index > 0 && 'border-t border-dark-600/30',
              item.best
                ? bestValueFrame(selected)
                : selected
                  ? 'bg-accent-500/15'
                  : 'hover:bg-dark-800/50',
              item.best && !selected && 'hover:bg-dark-800/50',
            )}
          >
            <span
              className={cn(
                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
                selected ? 'bg-accent-500' : 'ring-[1.6px] ring-inset ring-dark-400/60',
              )}
              aria-hidden
            >
              {selected && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-dark-50">{item.label}</span>
                {item.best && <BestValueBadge />}
                {item.discount}
              </span>
              {item.perMonth ? (
                <span className="mt-0.5 block text-[13.5px] text-dark-400">
                  {item.perMonth}/{t('subscription.month', 'мес')}
                  {item.saving ? (
                    <span className="ml-1.5 font-semibold text-success-400 light:text-success-700">
                      {t('subscription.v10.saving', 'выгода {{amount}}', { amount: item.saving })}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
            {/* Цена не рвётся между числом и знаком валюты. */}
            <span className="flex shrink-0 flex-col items-end">
              <span className="whitespace-nowrap font-display text-[17px] font-bold tabular-nums text-dark-50">
                {item.price}
              </span>
              {item.original ? (
                <span className="whitespace-nowrap text-[13px] text-dark-500 line-through">
                  {item.original}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
