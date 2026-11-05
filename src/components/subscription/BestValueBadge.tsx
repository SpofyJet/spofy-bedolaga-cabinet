import { useTranslation } from 'react-i18next';
import { StarIcon } from '@/components/icons';

/**
 * Отметка периода, выбранного оператором как самый выгодный.
 *
 * Палитра одноцветная, поэтому отметка отличается формой, а не оттенком: сплошная
 * плашка цвета главной кнопки. Выбор — тонкое кольцо, скидка — зелёный текст, и
 * рядом со скидкой «−25 %» отметка не читается как её продолжение.
 */
export function BestValueBadge({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-cta-500 px-2 py-0.5 text-2xs font-semibold text-on-cta ${className ?? ''}`}
    >
      <StarIcon filled className="h-3 w-3" />
      {t('subscription.bestValue')}
    </span>
  );
}

/** Цвет рамки выделенного периода — тот же токен, что и у отметки. */
export const BEST_VALUE_BORDER = 'rgba(var(--color-cta-500), 0.25)';

/**
 * Рамка отмеченного варианта — одна на все витрины: контур снаружи,
 * а у выбранного ещё и кольцо выбора внутри. Выбор не затирает контур, иначе
 * подсказка пропадала ровно у того варианта, к которому вела. Плашку при этом
 * ставить первой строкой карточки. Продление рисует то же самое через
 * BEST_VALUE_BORDER — там стили карточки инлайновые.
 */
export function bestValueFrame(selected: boolean): string {
  return selected
    ? 'border-2 border-cta-500/25 ring-2 ring-inset ring-accent-500'
    : 'border-2 border-cta-500/25';
}
