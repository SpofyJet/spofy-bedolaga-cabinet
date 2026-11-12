import { useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PiCheckCircleDuotone, PiClockDuotone, PiXCircleDuotone } from 'react-icons/pi';

import { balanceApi } from '../api/balance';
import { useAuthStore } from '../store/auth';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '@/platform';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Page, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import { loadTopUpPendingInfo, clearTopUpPendingInfo } from '../utils/topUpStorage';
import { getSafeRedirectPath } from '../utils/safeRedirect';
import { isPaidStatus, isFailedStatus } from '../utils/paymentStatus';
import { required } from '@/utils/required';

// ── Constants ────────────────────────────────────────────────
const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes
const POLL_INTERVAL_MS = 3_000;

// ── Sub-components ───────────────────────────────────────────

type Tone = 'accent' | 'success' | 'error' | 'muted';

/** Экран результата в стиле EmptyState: плитка-иконка, заголовок, текст, сумма, кнопки. */
function ResultScreen({
  tone,
  icon,
  title,
  text,
  amountKopeks,
  actions,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  text: string;
  amountKopeks: number | null;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const { formatMoney } = useCurrency();
  const toneClass = {
    accent: 'bg-accent-500/10 text-accent-400',
    success: 'bg-success-500/10 text-success-400',
    error: 'bg-error-500/10 text-error-400',
    muted: 'bg-dark-800/80 text-dark-300',
  }[tone];

  return (
    <Surface className="flex flex-col items-center px-6 py-10 text-center [overflow-wrap:anywhere]">
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-2xl [&>svg]:h-9 [&>svg]:w-9',
          toneClass,
        )}
      >
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-bold tracking-tight text-dark-50">{title}</h2>
      <p className="mt-1 max-w-sm text-[13px] leading-snug text-dark-400">{text}</p>
      {amountKopeks != null && amountKopeks > 0 && (
        <div className="mt-5">
          <span className="block text-[13px] text-dark-400">
            {t('balance.topUpResult.topUpAmount')}
          </span>
          <span className="mt-0.5 block text-[26px] font-bold leading-tight tracking-tight text-dark-50">
            {formatMoney(amountKopeks / 100)}
          </span>
        </div>
      )}
      {actions && <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">{actions}</div>}
    </Surface>
  );
}

function PendingState({ amountKopeks }: { amountKopeks: number | null }) {
  const { t } = useTranslation();

  return (
    <ResultScreen
      tone="accent"
      icon={
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-current border-t-transparent"
        />
      }
      title={t('balance.topUpResult.awaitingPayment')}
      text={t('balance.topUpResult.awaitingPaymentDesc')}
      amountKopeks={amountKopeks}
    />
  );
}

function SuccessState({
  amountKopeks,
  returnTo,
}: {
  amountKopeks: number | null;
  /** Экран, с которого человек ушёл платить (продление, покупка), или null. */
  returnTo: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoToBalance = useCallback(() => {
    navigate('/balance', { replace: true });
  }, [navigate]);

  // Человек платил, чтобы оформить подписку: ведём его обратно к оформлению с тем же
  // выбором. Раньше здесь были только «К балансу» и «На главную», и покупку
  // приходилось начинать заново. Списание — по его нажатию, само не происходит.
  if (returnTo) {
    return (
      <ResultScreen
        tone="success"
        icon={<PiCheckCircleDuotone />}
        title={t('balance.topUpResult.success')}
        text={t(
          'balance.topUpResult.successContinueDesc',
          'Деньги уже на балансе. Остался один шаг — подтвердить оформление.',
        )}
        amountKopeks={amountKopeks}
        actions={
          <>
            <Button onClick={() => navigate(returnTo, { replace: true })}>
              {t('balance.topUpResult.continue', 'Продолжить оформление')}
            </Button>
            <Button tone="secondary" onClick={() => navigate('/', { replace: true })}>
              {t('balance.topUpResult.toHome', 'На главную')}
            </Button>
          </>
        }
      />
    );
  }

  return (
    <ResultScreen
      tone="success"
      icon={<PiCheckCircleDuotone />}
      title={t('balance.topUpResult.success')}
      text={t('balance.topUpResult.successDesc')}
      amountKopeks={amountKopeks}
      actions={
        <>
          <Button onClick={handleGoToBalance}>{t('balance.topUpResult.goToBalance')}</Button>
          <Button tone="secondary" onClick={() => navigate('/', { replace: true })}>
            {t('balance.topUpResult.toHome', 'На главную')}
          </Button>
        </>
      }
    />
  );
}

function FailedState({ amountKopeks }: { amountKopeks: number | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleTryAgain = useCallback(() => {
    navigate('/balance', { replace: true });
  }, [navigate]);

  return (
    <ResultScreen
      tone="error"
      icon={<PiXCircleDuotone />}
      title={t('balance.topUpResult.failed')}
      text={t('balance.topUpResult.failedDesc')}
      amountKopeks={amountKopeks}
      actions={
        <>
          {/* Способы оплаты теперь на своей странице — «ещё раз» ведёт сразу к ним. */}
          <Button onClick={() => navigate('/balance/top-up', { replace: true })}>
            {t('balance.topUpResult.tryAgain')}
          </Button>
          <Button tone="secondary" onClick={handleTryAgain}>
            {t('balance.topUpResult.goToBalance')}
          </Button>
        </>
      }
    />
  );
}

function TimeoutState({ onRetry, onGoBack }: { onRetry: () => void; onGoBack: () => void }) {
  const { t } = useTranslation();

  return (
    <ResultScreen
      tone="muted"
      icon={<PiClockDuotone />}
      title={t('balance.topUpResult.timeout')}
      text={t('balance.topUpResult.timeoutDesc')}
      amountKopeks={null}
      actions={
        <>
          <Button onClick={onRetry}>{t('common.retry')}</Button>
          <Button tone="secondary" onClick={onGoBack}>
            {t('balance.topUpResult.goToBalance')}
          </Button>
        </>
      }
    />
  );
}

// ── Main Component ───────────────────────────────────────────

export default function TopUpResult() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const haptic = useHaptic();
  const pollStart = useRef(Date.now());
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const hapticFiredRef = useRef(false);
  const cleanedUpRef = useRef(false);

  // Load saved payment info from sessionStorage (once on mount)
  const [pendingInfo] = useState(() => loadTopUpPendingInfo());
  // Куда вернуть после оплаты. Путь пришёл из адресной строки экрана пополнения,
  // поэтому пропускаем только пути внутри кабинета.
  const safeReturnTo = getSafeRedirectPath(pendingInfo?.return_to);
  const returnTo = pendingInfo?.return_to && safeReturnTo !== '/' ? safeReturnTo : null;

  // Fallback: read method for external-browser redirects where sessionStorage is unavailable.
  // Providers that reject query strings return to /balance/top-up/result/<method>, so
  // accept the method from the path param too, not just ?method=.
  const { method: methodFromPath } = useParams<{ method?: string }>();
  const methodFromUrl = searchParams.get('method') || methodFromPath || null;

  // Detect if user arrived via redirect with success param (no polling needed)
  const redirectStatus = searchParams.get('status') || searchParams.get('payment');
  const isRedirectSuccess = redirectStatus
    ? isPaidStatus(redirectStatus)
    : searchParams.get('success') === 'true';
  const isRedirectFailed = redirectStatus ? isFailedStatus(redirectStatus) : false;

  // Determine if we can poll by specific payment_id (need method + numeric payment_id)
  const parsedPaymentId = pendingInfo?.payment_id ? parseInt(pendingInfo.payment_id, 10) : NaN;
  const canPollById =
    !!(pendingInfo?.method_id && !Number.isNaN(parsedPaymentId)) &&
    !isRedirectSuccess &&
    !isRedirectFailed;

  // Fallback: poll by method via /latest endpoint when no sessionStorage data
  const canPollByMethod =
    !canPollById && !!methodFromUrl && !isRedirectSuccess && !isRedirectFailed;

  // Poll payment status by specific ID (primary path — sessionStorage available)
  const { data: paymentStatus, refetch } = useQuery({
    queryKey: ['topup-status', pendingInfo?.method_id, parsedPaymentId],
    queryFn: () => balanceApi.getPendingPayment(required(pendingInfo).method_id, parsedPaymentId),
    enabled: canPollById && !pollTimedOut,
    refetchInterval: (query) => {
      const payment = query.state.data;
      if (
        payment &&
        (payment.is_paid || isPaidStatus(payment.status) || isFailedStatus(payment.status))
      ) {
        return false;
      }

      if (Date.now() - pollStart.current > MAX_POLL_MS) {
        setPollTimedOut(true);
        return false;
      }

      return POLL_INTERVAL_MS;
    },
    retry: 2,
  });

  // Poll payment status by method latest (fallback — external browser, no sessionStorage)
  const { data: latestPayment, refetch: refetchLatest } = useQuery({
    queryKey: ['topup-status-latest', methodFromUrl],
    queryFn: () => balanceApi.getLatestPayment(required(methodFromUrl)),
    enabled: canPollByMethod && !pollTimedOut,
    refetchInterval: (query) => {
      const payment = query.state.data;
      if (
        payment &&
        (payment.is_paid || isPaidStatus(payment.status) || isFailedStatus(payment.status))
      ) {
        return false;
      }

      if (Date.now() - pollStart.current > MAX_POLL_MS) {
        setPollTimedOut(true);
        return false;
      }

      return POLL_INTERVAL_MS;
    },
    retry: 2,
  });

  // Merge both polling sources
  const effectivePayment = paymentStatus ?? latestPayment;

  // biome-ignore lint/correctness/useExhaustiveDependencies: setPollTimedOut — намеренный повод перезапуска
  const handleRetryPoll = useCallback(() => {
    pollStart.current = Date.now();
    setPollTimedOut(false);
    if (canPollById) {
      refetch();
    } else {
      refetchLatest();
    }
  }, [canPollById, setPollTimedOut, refetch, refetchLatest]);

  const handleGoBack = useCallback(() => {
    clearTopUpPendingInfo();
    navigate('/balance', { replace: true });
  }, [navigate]);

  // Redirect to balance if absolutely no data source available
  useEffect(() => {
    if (!pendingInfo && !redirectStatus && !methodFromUrl) {
      navigate('/balance', { replace: true });
    }
  }, [pendingInfo, redirectStatus, methodFromUrl, navigate]);

  // Determine current visual state
  const amountKopeks = effectivePayment?.amount_kopeks ?? pendingInfo?.amount_kopeks ?? null;

  const resolvedPaid =
    isRedirectSuccess ||
    effectivePayment?.is_paid ||
    (effectivePayment && isPaidStatus(effectivePayment.status));

  const resolvedFailed =
    isRedirectFailed || (effectivePayment && isFailedStatus(effectivePayment.status));

  // Clean up sessionStorage and invalidate queries when payment resolves
  useEffect(() => {
    if (cleanedUpRef.current) return;
    if (resolvedPaid) {
      cleanedUpRef.current = true;
      clearTopUpPendingInfo();
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'subscription',
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      refreshUser();
    } else if (resolvedFailed) {
      cleanedUpRef.current = true;
      clearTopUpPendingInfo();
    }
  }, [resolvedPaid, resolvedFailed, queryClient, refreshUser]);

  // Haptic feedback on status resolution (fire once)
  useEffect(() => {
    if (hapticFiredRef.current) return;
    if (resolvedPaid) {
      hapticFiredRef.current = true;
      haptic.notification('success');
    } else if (resolvedFailed) {
      hapticFiredRef.current = true;
      haptic.notification('error');
    }
  }, [resolvedPaid, resolvedFailed, haptic]);

  return (
    <div className="min-h-dvh bg-dark-950 px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] sm:pt-16">
      <Page>
        <PageHeader title={t('balance.topUpBalance')} backTo="/balance" />
        <div aria-live="polite" aria-atomic="true">
          {resolvedPaid ? (
            <SuccessState amountKopeks={amountKopeks} returnTo={returnTo} />
          ) : resolvedFailed ? (
            <FailedState amountKopeks={amountKopeks} />
          ) : pollTimedOut ? (
            <TimeoutState onRetry={handleRetryPoll} onGoBack={handleGoBack} />
          ) : (
            <PendingState amountKopeks={amountKopeks} />
          )}
        </div>
      </Page>
    </div>
  );
}
