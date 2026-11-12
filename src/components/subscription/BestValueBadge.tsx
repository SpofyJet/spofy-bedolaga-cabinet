import { useTranslation } from 'react-i18next';

/**
 * Отметка варианта, который оператор выбрал как самый выгодный.
 *
 * Спокойный чип цвета акцента (12.11): залитой на экране остаётся одна главная
 * кнопка, отметка рядом с названием с ней не спорит. Выбор — заливка строки,
 * скидка — зелёный текст, и рядом со скидкой «−25 %» отметка не читается как её
 * продолжение.
 */
export function BestValueBadge({ className, label }: { className?: string; label?: string }) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-accent-500/25 px-[9px] text-xs font-semibold text-accent-400 ${className ?? ''}`}
    >
      {label ?? t('subscription.bestValue')}
    </span>
  );
}

/** Цвет выделенного периода — тот же токен, что и у отметки. */
export const BEST_VALUE_BORDER = 'rgba(var(--color-cta-500), 0.25)';

/**
 * Выделение отмеченного варианта — одно на все витрины: отметка рядом с
 * названием, а у выбранного ещё и заливка выбора. Выбор отметку не затирает,
 * иначе подсказка пропадала ровно у того варианта, к которому вела.
 */
export function bestValueFrame(selected: boolean): string {
  return selected ? 'bg-accent-500/15' : '';
}
