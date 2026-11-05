import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PiCaretLeftBold } from 'react-icons/pi';

import { useHaptic } from '@/platform';

interface PageHeaderProps {
  title: ReactNode;
  /** Куда вести «Назад», если открыли страницу напрямую (без истории). */
  backTo?: string;
  /** Без кнопки «Назад» — только у вкладок нижней панели. */
  noBack?: boolean;
  subtitle?: ReactNode;
  /** Действие справа (иконка-кнопка). */
  right?: ReactNode;
}

/**
 * Шапка страницы Spofy: «Назад», заголовок, подзаголовок. «Назад» видна везде,
 * в том числе в Telegram: нативная кнопка есть не в каждом клиенте и не на
 * каждом экране, а застревать на странице нельзя.
 */
export function PageHeader({ title, backTo = '/', noBack, subtitle, right }: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const haptic = useHaptic();
  const { t } = useTranslation();

  const goBack = () => {
    haptic.impact('light');
    // location.key === 'default' — страницу открыли напрямую, истории нет.
    if (location.key !== 'default' && window.history.length > 1) navigate(-1);
    else navigate(backTo, { replace: true });
  };

  return (
    <header className="mb-5 flex items-center gap-3">
      {!noBack && (
        <button
          type="button"
          onClick={goBack}
          aria-label={t('common.back', 'Назад')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-dark-900/70 text-dark-200 transition-colors hover:bg-dark-800/70 hover:text-dark-50 active:scale-95"
        >
          <PiCaretLeftBold className="h-[18px] w-[18px]" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight text-dark-50 sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 truncate text-[13px] text-dark-400">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
