/**
 * Строительные блоки дизайна Spofy (v9/v10). Все пользовательские страницы
 * собираются из них — так нет «старых карточек» рядом с новыми.
 *
 * Правила стиля:
 * - колонка max-w-[600px] по центру, отступы между блоками space-y-6;
 * - поверхность: rounded-3xl bg-dark-900/70 + ring-1 ring-inset ring-dark-800/80, без теней и стекла;
 * - заголовки секций — 13px semibold dark-400, обычным регистром (без КАПСА и моно-шрифта);
 * - иконки — react-icons/pi Duotone в плитке 40×40 accent-500/10;
 * - основная кнопка — accent-500, вторичная — dark-800/70; высота 48px;
 * - никаких нейро-картинок, градиентных «стеклянных» карточек и декоративных орбов.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { PiCaretRightBold } from 'react-icons/pi';

import { cn } from '@/lib/utils';

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[600px] space-y-6', className)}>{children}</div>;
}

export function Surface({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section';
}) {
  return (
    <As
      className={cn(
        'rounded-3xl bg-dark-900/70 p-4 ring-1 ring-inset ring-dark-800/80 sm:p-5',
        className,
      )}
    >
      {children}
    </As>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="text-[13px] font-semibold text-dark-400">{children}</h2>
      {right}
    </div>
  );
}

/** Группа строк (как в профиле): общий фон, разделители между строками. */
export function Group({
  title,
  right,
  children,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {title && <SectionTitle right={right}>{title}</SectionTitle>}
      <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-900/70 ring-1 ring-inset ring-dark-800/80">
        {children}
      </div>
    </section>
  );
}

export function RowIcon({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'error' | 'muted';
}) {
  const toneClass = {
    accent: 'bg-accent-500/10 text-accent-400',
    success: 'bg-success-500/10 text-success-400',
    warning: 'bg-warning-500/10 text-warning-400',
    error: 'bg-error-500/10 text-error-400',
    muted: 'bg-dark-800/80 text-dark-300',
  }[tone];
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-[22px] [&>svg]:w-[22px]',
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

interface RowProps {
  icon?: ReactNode;
  iconTone?: 'accent' | 'success' | 'warning' | 'error' | 'muted';
  label: ReactNode;
  /** Вторая строка под заголовком. */
  description?: ReactNode;
  /** Значение справа (серым). */
  hint?: ReactNode;
  /** Произвольный элемент справа вместо hint/стрелки (переключатель, сумма). */
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/** Строка группы: ссылка (to), кнопка (onClick) или просто строка. */
export function Row({
  icon,
  iconTone,
  label,
  description,
  hint,
  trailing,
  to,
  onClick,
  disabled,
}: RowProps) {
  const body = (
    <>
      {icon && <RowIcon tone={iconTone}>{icon}</RowIcon>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-dark-100">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[13px] leading-snug text-dark-400">{description}</span>
        )}
      </span>
      {trailing ?? (
        <>
          {hint && <span className="max-w-[45%] truncate text-[13px] text-dark-400">{hint}</span>}
          {(to || onClick) && (
            <PiCaretRightBold className="h-3.5 w-3.5 shrink-0 text-dark-500" aria-hidden />
          )}
        </>
      )}
    </>
  );
  const cls = cn(
    'flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left',
    (to || onClick) && !disabled && 'transition-colors hover:bg-dark-800/40 active:bg-dark-800/60',
    disabled && 'opacity-50',
  );
  if (to && !disabled)
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  tone = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  const toneClass = {
    primary: 'bg-accent-500 text-on-accent hover:bg-accent-600 disabled:bg-accent-500/40',
    secondary:
      'bg-dark-800/70 text-dark-100 ring-1 ring-inset ring-dark-700/60 hover:bg-dark-700/70',
    danger:
      'bg-error-500/10 text-error-400 ring-1 ring-inset ring-error-500/25 hover:bg-error-500/15',
    ghost: 'text-accent-400 hover:bg-accent-500/10',
  }[tone];
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition-colors active:scale-[0.98] disabled:cursor-not-allowed',
        toneClass,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Маленький статус-чип (Активна / Пробный / Истекла). */
export function Chip({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'error' | 'muted';
}) {
  const toneClass = {
    accent: 'border-accent-500/30 bg-accent-500/10 text-accent-300',
    success: 'border-success-500/25 bg-success-500/10 text-success-400',
    warning: 'border-warning-500/25 bg-warning-500/10 text-warning-400',
    error: 'border-error-500/25 bg-error-500/10 text-error-400',
    muted: 'border-dark-700/60 bg-dark-800/60 text-dark-300',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-2xs font-semibold',
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

/** Крупная цифра с подписью (баланс, заработок, лимит). */
export function Stat({
  label,
  value,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-sm font-medium text-dark-400">{label}</span>
      <span className="mt-1 block truncate text-[26px] font-bold leading-tight tracking-tight text-dark-50">
        {value}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-dark-400">{hint}</span>}
    </div>
  );
}

/** Пустое состояние: иконка, заголовок, текст, действие. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Surface className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <RowIcon>{icon}</RowIcon>}
      <p className="mt-3 text-[15px] font-semibold text-dark-100">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] leading-snug text-dark-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Surface>
  );
}
