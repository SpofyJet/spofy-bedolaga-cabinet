import { cn } from '@/lib/utils';

/** Небольшая цифра кампании: подпись сверху, значение ниже, без иконок и моно. */
export function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'accent' | 'success';
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-dark-800/40 p-3">
      <span className="block truncate text-xs text-dark-400">{label}</span>
      <span
        className={cn(
          'mt-0.5 block truncate text-[17px] font-semibold',
          tone === 'accent'
            ? 'text-accent-400'
            : tone === 'success'
              ? 'text-success-400'
              : 'text-dark-100',
        )}
      >
        {value}
      </span>
    </div>
  );
}
