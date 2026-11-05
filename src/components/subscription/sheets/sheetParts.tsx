import type { ReactNode } from 'react';
import { PiMinusBold, PiPlusBold } from 'react-icons/pi';

import { cn } from '@/lib/utils';

/**
 * Общие куски шитов подписки (докупка устройств, трафика, уменьшение лимита,
 * локации): тело шита и счётчик «− N +». Живут рядом с шитами, а не в общем
 * наборе блоков: нужны только здесь.
 */

export function SheetBody({ children }: { children: ReactNode }) {
  return <div className="space-y-4 px-4 pb-6 pt-4 sm:px-5">{children}</div>;
}

/** Плашка-пояснение внутри шита. */
export function SheetNote({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'warning' | 'success';
}) {
  return (
    <p
      className={cn(
        'rounded-2xl px-3.5 py-3 text-[13px] leading-snug',
        tone === 'muted' && 'bg-dark-800/60 text-dark-300',
        tone === 'warning' && 'bg-warning-500/10 text-warning-400',
        tone === 'success' && 'bg-success-500/10 text-success-400',
      )}
    >
      {children}
    </p>
  );
}

const stepBtn =
  'flex h-12 w-12 items-center justify-center rounded-2xl bg-dark-800/70 text-dark-100 transition-colors hover:bg-dark-700/70 active:scale-95 disabled:opacity-40';

/** Счётчик «− N +» с подписью под числом. */
export function Stepper({
  value,
  unit,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
  decrementLabel,
  incrementLabel,
}: {
  value: number;
  unit: ReactNode;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  decrementLabel: string;
  incrementLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl bg-dark-800/40 p-3">
      <button
        type="button"
        onClick={onDecrement}
        disabled={decrementDisabled}
        className={stepBtn}
        aria-label={decrementLabel}
      >
        <PiMinusBold className="h-5 w-5" />
      </button>
      <div className="text-center">
        <div className="text-[26px] font-bold leading-tight tabular-nums text-dark-50">{value}</div>
        <div className="text-[13px] text-dark-400">{unit}</div>
      </div>
      <button
        type="button"
        onClick={onIncrement}
        disabled={incrementDisabled}
        className={stepBtn}
        aria-label={incrementLabel}
      >
        <PiPlusBold className="h-5 w-5" />
      </button>
    </div>
  );
}

/** Строка «название — сумма» в итоге шита. */
export function TotalLine({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="text-[15px] font-medium text-dark-300">{label}</span>
      <span className="text-right text-xl font-bold tabular-nums text-dark-50">{children}</span>
    </div>
  );
}

export function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
