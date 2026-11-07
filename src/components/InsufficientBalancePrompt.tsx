import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../hooks/useCurrency';
import { InfoIcon, WalletIcon, PlusIcon } from '@/components/icons';
import { Button, RowIcon } from '@/components/spofy/ui';

interface InsufficientBalancePromptProps {
  /** Amount missing in kopeks */
  missingAmountKopeks: number;
  /** Optional custom message */
  message?: string;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Additional className */
  className?: string;
  /** Callback to execute before opening top-up modal (e.g., save cart) */
  onBeforeTopUp?: () => Promise<void>;
}

export default function InsufficientBalancePrompt({
  missingAmountKopeks,
  message,
  compact = false,
  className = '',
  onBeforeTopUp,
}: InsufficientBalancePromptProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatAmount, currencySymbol } = useCurrency();
  const [isPreparingTopUp, setIsPreparingTopUp] = useState(false);

  const missingRubles = missingAmountKopeks / 100;
  const displayAmount = formatAmount(missingRubles);

  const handleTopUpClick = async () => {
    if (onBeforeTopUp) {
      setIsPreparingTopUp(true);
      try {
        await onBeforeTopUp();
      } catch {
        // Silently ignore errors - still navigate
      } finally {
        setIsPreparingTopUp(false);
      }
    }
    const params = new URLSearchParams();
    params.set('amount', String(Math.ceil(missingRubles)));
    params.set('returnTo', location.pathname);
    navigate(`/balance/top-up?${params.toString()}`);
  };

  const amountText = (
    <span className="whitespace-nowrap font-semibold">
      {displayAmount}
      {'\u00A0'}
      {currencySymbol}
    </span>
  );

  if (compact) {
    return (
      <div
        // В узком листе текст и «Пополнить» рядом не помещались — кнопка
        // вылезала за плашку. Не влезли — кнопка уходит строкой ниже.
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-dark-800/50 p-3 ${className}`}
      >
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-sm text-dark-200">
          <InfoIcon className="h-4 w-4 flex-shrink-0 text-warning-400" />
          <span>
            {message || t('balance.insufficientFunds')}:{' '}
            <span className="text-warning-400">{amountText}</span>
          </span>
        </div>
        <Button
          onClick={handleTopUpClick}
          disabled={isPreparingTopUp}
          aria-busy={isPreparingTopUp}
          className="h-9 shrink-0 whitespace-nowrap rounded-xl px-3 text-[13px]"
        >
          {isPreparingTopUp && <Spinner small />}
          {t('balance.topUp')}
        </Button>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-dark-800/50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <RowIcon tone="warning">
          <WalletIcon />
        </RowIcon>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-dark-100">
            {t('balance.insufficientFunds')}
          </div>
          <div className="mt-0.5 text-[13px] leading-snug text-dark-400">
            {message || t('balance.topUpToComplete')}
          </div>
          <div className="mt-2 text-[15px] text-dark-200">
            {t('balance.missing')}: <span className="text-warning-400">{amountText}</span>
          </div>
        </div>
      </div>
      <Button
        onClick={handleTopUpClick}
        disabled={isPreparingTopUp}
        aria-busy={isPreparingTopUp}
        className="mt-4 w-full"
      >
        {isPreparingTopUp ? <Spinner /> : <PlusIcon className="h-5 w-5" />}
        {t('balance.topUpBalance')}
      </Button>
    </div>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`${small ? 'h-3 w-3 border' : 'h-4 w-4 border-2'} animate-spin rounded-full border-current border-t-transparent`}
    />
  );
}
