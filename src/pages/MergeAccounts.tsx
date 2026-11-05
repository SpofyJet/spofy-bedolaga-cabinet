import { isLifetimeEndDate } from '@/utils/lifetime';
import { uiLocale } from '@/utils/uiLocale';
import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from '../components/Toast';
import { PageHeader } from '@/components/layout/PageHeader';

// Поверхности Spofy вместо старых карточек: плоский фон, тонкое кольцо.
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-3xl bg-dark-900/70 p-4 sm:p-5', className)}>{children}</div>;
}
function CardHeader({ children }: { children: ReactNode }) {
  return <div className="mb-3">{children}</div>;
}
function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[15px] font-semibold text-dark-100">{children}</h2>;
}
function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className}>{children}</div>;
}
import { Button } from '@/components/primitives/Button';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import ProviderIcon from '../components/ProviderIcon';
import type { MergeAccountPreview } from '../types';
import { CheckCircleIcon, ClockIcon, WarningIcon } from '@/components/icons';

// -- Helpers --

function ProviderBadgeIcon({ provider }: { provider: string }) {
  return <ProviderIcon provider={provider} className="h-4 w-4" />;
}

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const min = Math.floor(clamped / 60);
  const sec = clamped % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(uiLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatBalance(kopeks: number): string {
  return Math.floor(kopeks / 100).toLocaleString(uiLocale());
}

// -- Radio Indicator --

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <div
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
        selected ? 'bg-accent-500' : 'bg-dark-700',
      )}
    >
      {selected && <div className="h-2 w-2 rounded-full bg-white" />}
    </div>
  );
}

// -- Account Card --

interface AccountCardProps {
  account: MergeAccountPreview;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  showRadio: boolean;
}

function AccountCard({ account, label, isSelected, onSelect, showRadio }: AccountCardProps) {
  const { t } = useTranslation();

  return (
    <Card className={cn('transition-colors', isSelected && 'bg-accent-500/15')}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auth methods */}
        <div>
          <span className="text-sm text-dark-400">{t('merge.authMethods')}:</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {account.auth_methods.map((method) => (
              <span
                key={method}
                className="inline-flex items-center gap-1.5 rounded-md bg-dark-800 px-2.5 py-1 text-xs text-dark-200"
              >
                <ProviderBadgeIcon provider={method} />
                {t(`profile.accounts.providers.${method}`)}
              </span>
            ))}
          </div>
        </div>

        {/* Subscription */}
        {account.subscription ? (
          <div className="space-y-1">
            <span className="text-sm text-dark-400">{t('merge.subscription')}:</span>
            <p className="font-medium text-dark-100">
              {account.subscription.tariff_name ?? account.subscription.status}
            </p>
            {account.subscription.end_date && (
              <p className="text-sm text-dark-400">
                {isLifetimeEndDate(account.subscription.end_date)
                  ? t('subscription.lifetime.forever')
                  : t('merge.until', { date: formatDate(account.subscription.end_date) })}
              </p>
            )}
            <p className="text-sm text-dark-400">
              {/* 0 ГБ у панели и бота — безлимит, а не «нет трафика». */}
              {t('merge.traffic')}:{' '}
              {account.subscription.traffic_limit_gb > 0
                ? `${account.subscription.traffic_limit_gb} ${t('common.units.gb')}`
                : t('subscription.unlimited')}
              , {t('merge.devices')}: {account.subscription.device_limit}
            </p>
          </div>
        ) : (
          <div>
            <span className="text-sm text-dark-400">{t('merge.subscription')}:</span>
            <p className="text-sm text-dark-500">{t('merge.noSubscription')}</p>
          </div>
        )}

        {/* Balance */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm text-dark-400">{t('merge.balance')}:</span>
          <span className="font-medium text-dark-100">
            {formatBalance(account.balance_kopeks)} &#8381;
          </span>
        </div>

        {/* Radio selection */}
        {showRadio && account.subscription && (
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={onSelect}
            className="mt-2 flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-dark-800/50 px-4 py-2.5 text-left transition-colors hover:bg-dark-800"
          >
            <RadioIndicator selected={isSelected} />
            <span className="text-sm text-dark-200">{t('merge.keepThisSubscription')}</span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// -- Loading Skeleton --

function LoadingSkeleton() {
  return (
    <SkeletonGroup>
      <motion.div
        className="mx-auto max-w-[600px] space-y-6 px-4 py-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItem}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 shrink-0" />
            <Skeleton className="h-7 w-48" />
          </div>
        </motion.div>

        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div key={i} variants={staggerItem}>
            <Card>
              <div className="space-y-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </Card>
          </motion.div>
        ))}

        <motion.div variants={staggerItem}>
          <Skeleton className="h-12 w-full rounded-xl" />
        </motion.div>

        <motion.div variants={staggerItem} className="flex justify-center">
          <Skeleton className="h-4 w-32" />
        </motion.div>
      </motion.div>
    </SkeletonGroup>
  );
}

// -- Expired State --

function ExpiredState() {
  const { t } = useTranslation();

  return (
    <motion.div
      className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-500/10">
          <ClockIcon className="h-7 w-7 text-warning-400" />
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="text-center">
        <p className="text-lg font-medium text-dark-100">{t('merge.expired')}</p>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Link
          to="/profile/accounts"
          className="text-sm text-accent-400 transition-colors hover:text-accent-300"
        >
          {t('profile.accounts.goToAccounts')}
        </Link>
      </motion.div>
    </motion.div>
  );
}

// -- Error State --

function ErrorState() {
  const { t } = useTranslation();

  return (
    <motion.div
      className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-500/10">
          <WarningIcon className="h-7 w-7 text-error-400" />
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="text-center">
        <p className="text-lg font-medium text-dark-100">{t('merge.error')}</p>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Link
          to="/profile/accounts"
          className="text-sm text-accent-400 transition-colors hover:text-accent-300"
        >
          {t('profile.accounts.goToAccounts')}
        </Link>
      </motion.div>
    </motion.div>
  );
}

// -- Main Component --

export default function MergeAccounts() {
  const { t } = useTranslation();
  const { mergeToken } = useParams<{ mergeToken: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  // Fetch merge preview (no auth required)
  const { data, isLoading, error } = useQuery({
    queryKey: ['merge-preview', mergeToken],
    queryFn: () => {
      if (!mergeToken) return Promise.reject(new Error('Missing merge token'));
      return authApi.getMergePreview(mergeToken);
    },
    enabled: !!mergeToken,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Auto-select subscription when data loads (only once)
  useEffect(() => {
    if (!data) return;
    // Don't overwrite if user already made a selection
    if (selectedUserId !== null) return;

    const primaryHasSub = !!data.primary.subscription;
    const secondaryHasSub = !!data.secondary.subscription;

    if (primaryHasSub && !secondaryHasSub) {
      setSelectedUserId(data.primary.id);
    } else if (!primaryHasSub && secondaryHasSub) {
      setSelectedUserId(data.secondary.id);
    } else if (!primaryHasSub && !secondaryHasSub) {
      // Neither has subscription — default to primary
      setSelectedUserId(data.primary.id);
    }
    // If both have subs — null until user picks
  }, [data, selectedUserId]);

  // Countdown timer (wall-clock based to avoid drift)
  useEffect(() => {
    if (!data) return;
    const startTime = Date.now();
    const totalSeconds = data.expires_in_seconds;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = totalSeconds - elapsed;
      if (remaining <= 0) {
        setExpiresIn(0);
        setIsExpired(true);
        clearInterval(interval);
      } else {
        setExpiresIn(remaining);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data]);

  // Execute merge
  const mergeMutation = useMutation({
    mutationFn: () => {
      if (!mergeToken || !selectedUserId) {
        return Promise.reject(new Error('Missing merge token or user selection'));
      }
      return authApi.executeMerge(mergeToken, selectedUserId);
    },
    onSuccess: async (response) => {
      if (!response.success) {
        showToast({ type: 'error', message: t('merge.error') });
        return;
      }

      if (!response.access_token || !response.refresh_token) {
        showToast({ type: 'error', message: t('merge.error') });
        return;
      }

      const { setTokens, setUser, checkAdminStatus } = useAuthStore.getState();
      setTokens(response.access_token, response.refresh_token);
      if (response.user) {
        setUser(response.user);
      }
      try {
        await checkAdminStatus();
      } catch {
        // Non-critical — admin status will be checked on next navigation
      }

      queryClient.clear();
      showToast({ type: 'success', message: t('merge.success') });
      navigate('/profile/accounts', { replace: true });
    },
    onError: () => {
      showToast({
        type: 'error',
        message: t('merge.error'),
      });
    },
  });

  const handleMerge = () => {
    if (!selectedUserId || mergeMutation.isPending || isExpired) return;
    mergeMutation.mutate();
  };

  const handleCancel = () => {
    navigate('/profile/accounts', { replace: true });
  };

  // Derived state
  const bothHaveSubscriptions =
    data && !!data.primary.subscription && !!data.secondary.subscription;
  const canConfirm = selectedUserId !== null && !isExpired && !mergeMutation.isPending;
  const combinedBalance = data ? data.primary.balance_kopeks + data.secondary.balance_kopeks : 0;

  // Missing token param
  if (!mergeToken) {
    return <ErrorState />;
  }

  // Loading
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Fetch error (404 = expired/invalid token)
  if (error || !data) {
    return <ErrorState />;
  }

  // Timer expired
  if (isExpired) {
    return <ExpiredState />;
  }

  return (
    // Экран живёт вне общей обвязки кабинета — отступы от краёв задаёт сам,
    // иначе карточки и кнопка «Объединить» стояли вплотную к краю экрана.
    <motion.div
      className="mx-auto max-w-[600px] space-y-6 px-4 py-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Header with warning */}
      <motion.div variants={staggerItem}>
        <PageHeader title={t('merge.title')} backTo="/" />
        <Card className="bg-warning-500/10">
          <div className="flex items-start gap-3">
            <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning-400" />
            <p className="text-sm text-dark-200">{t('merge.description')}</p>
          </div>
        </Card>
      </motion.div>

      {/* Subscription choice prompt (when both have subs) */}
      {bothHaveSubscriptions && !selectedUserId && (
        <motion.div variants={staggerItem}>
          <div className="rounded-2xl bg-accent-500/10 px-4 py-3">
            <p className="text-sm font-medium text-accent-400">{t('merge.chooseSubscription')}</p>
          </div>
        </motion.div>
      )}

      {/* Account cards */}
      <div
        role={bothHaveSubscriptions ? 'radiogroup' : undefined}
        aria-label={bothHaveSubscriptions ? t('merge.chooseSubscription') : undefined}
      >
        <motion.div variants={staggerItem}>
          <AccountCard
            account={data.primary}
            label={t('merge.currentAccount')}
            isSelected={selectedUserId === data.primary.id}
            onSelect={() => setSelectedUserId(data.primary.id)}
            showRadio={!!bothHaveSubscriptions}
          />
        </motion.div>

        <motion.div variants={staggerItem} className="mt-6">
          <AccountCard
            account={data.secondary}
            label={t('merge.foundAccount')}
            isSelected={selectedUserId === data.secondary.id}
            onSelect={() => setSelectedUserId(data.secondary.id)}
            showRadio={!!bothHaveSubscriptions}
          />
        </motion.div>
      </div>

      {/* After merge summary */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>{t('merge.afterMerge')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success-400" />
                <span className="text-sm text-dark-200">{t('merge.allAuthMethodsMerged')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success-400" />
                <span className="text-sm text-dark-200">
                  {t('merge.balanceSummed', { amount: formatBalance(combinedBalance) })}
                </span>
              </li>
              {bothHaveSubscriptions && (
                <li className="flex items-start gap-2.5">
                  <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning-400" />
                  <span className="text-sm text-dark-200">
                    {t('merge.unselectedSubscriptionDeleted')}
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success-400" />
                <span className="text-sm text-dark-200">{t('merge.historyPreserved')}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {/* Confirm button */}
      <motion.div variants={staggerItem}>
        <Button
          fullWidth
          disabled={!canConfirm}
          loading={mergeMutation.isPending}
          onClick={handleMerge}
        >
          {mergeMutation.isPending ? t('merge.merging') : t('merge.confirm')}
        </Button>
      </motion.div>

      {/* Cancel link */}
      <motion.div variants={staggerItem} className="flex justify-center">
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-dark-400 transition-colors hover:text-dark-200"
        >
          {t('merge.cancel')}
        </button>
      </motion.div>

      {/* Countdown timer */}
      <motion.div variants={staggerItem} className="flex items-center justify-center gap-1.5 pb-6">
        <ClockIcon className="h-4 w-4 text-dark-500" />
        <span className="text-sm text-dark-500">
          {t('merge.expiresIn', { minutes: formatCountdown(expiresIn) })}
        </span>
      </motion.div>
    </motion.div>
  );
}
