import { isLifetimePeriod } from '@/utils/lifetime';
import { uiLocale } from '@/utils/uiLocale';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { wheelApi, type WheelPrize, type SpinResult, type SpinHistoryItem } from '../api/wheel';
import FortuneWheel from '../components/wheel/FortuneWheel';
import WheelLegend from '../components/wheel/WheelLegend';
import { usePlatform, useHaptic } from '@/platform';
import { useNotify } from '@/platform/hooks/useNotify';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import {
  PiCalendarDuotone,
  PiCaretDownBold,
  PiClockCounterClockwiseDuotone,
  PiSpinnerBallDuotone,
  PiWarningCircleDuotone,
  PiXBold,
} from 'react-icons/pi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Page, Row, SectionTitle, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * Rotation (mod 360) that brings sector `prizeIndex` under the top pointer.
 * Mirrors the backend _calculate_rotation logic in wheel_service.py.
 */
function rotationForIndex(prizes: WheelPrize[], prizeIndex: number): number {
  if (prizes.length === 0) return 0;
  const sectorAngle = 360 / prizes.length;
  const baseAngle = prizeIndex * sectorAngle + sectorAngle / 2;
  const offset = (Math.random() - 0.5) * sectorAngle * 0.6; // ±30% within the sector
  return 360 - baseAngle + offset;
}

/** Index of the "Nothing" sector, or 0 if there isn't one. */
function neutralIndex(prizes: WheelPrize[]): number {
  const idx = prizes.findIndex((p) => p.prize_type === 'nothing');
  return idx === -1 ? 0 : idx;
}

/**
 * Rotation that lands the wheel on the ACTUAL won prize's sector.
 *
 * Matches by prize_id (exact). It must NEVER land on a random sector: a random
 * angle was the root cause of "the wheel shows месяц/50₽ but the result is
 * Ничего" on the browser Stars path — when the prize couldn't be located the old
 * code span to Math.random()*360, which often pointed at a winning slot. When the
 * prize can't be resolved we land on the neutral ("Nothing") sector instead, so
 * the animation never falsely celebrates a win.
 */
function calculateRotationForPrize(prizes: WheelPrize[], result: SpinResult): number {
  let prizeIndex = result.prize_id != null ? prizes.findIndex((p) => p.id === result.prize_id) : -1;

  // Defensive fallbacks for older payloads without prize_id: name+emoji, then name.
  if (prizeIndex === -1 && result.prize_display_name) {
    prizeIndex = prizes.findIndex(
      (p) => p.display_name === result.prize_display_name && p.emoji === result.emoji,
    );
    if (prizeIndex === -1) {
      prizeIndex = prizes.findIndex((p) => p.display_name === result.prize_display_name);
    }
  }

  if (prizeIndex === -1) prizeIndex = neutralIndex(prizes); // unknown → neutral, never random

  return rotationForIndex(prizes, prizeIndex);
}

/**
 * Rotation used when the real result is unknown (e.g. the Stars-payment poll timed
 * out). Lands on the neutral ("Nothing") sector — never a random/winning angle.
 */
function neutralRotation(prizes: WheelPrize[]): number {
  return rotationForIndex(prizes, neutralIndex(prizes));
}

export default function Wheel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openInvoice, capabilities } = usePlatform();
  const haptic = useHaptic();
  const notify = useNotify();

  const [isSpinning, setIsSpinning] = useState(false);
  const [targetRotation, setTargetRotation] = useState<number | null>(null);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [paymentType, setPaymentType] = useState<'telegram_stars' | 'subscription_days'>(
    'telegram_stars',
  );
  const [isPayingStars, setIsPayingStars] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showStarsConfirm, setShowStarsConfirm] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const paymentTypeInitialized = useRef(false);

  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['wheel-config'],
    queryFn: wheelApi.getConfig,
  });

  const { data: history } = useQuery({
    queryKey: ['wheel-history'],
    queryFn: () => wheelApi.getHistory(1, 10),
  });

  // Auto-select payment type based on availability (only on initial load)
  useEffect(() => {
    if (!config || paymentTypeInitialized.current) return;
    paymentTypeInitialized.current = true;

    const starsEnabled = config.spin_cost_stars_enabled && config.spin_cost_stars;
    const daysEnabled = config.spin_cost_days_enabled && config.spin_cost_days;

    if (starsEnabled) {
      setPaymentType('telegram_stars');
    } else if (daysEnabled) {
      setPaymentType('subscription_days');
    }

    // Auto-select subscription if only one eligible
    if (config.eligible_subscriptions?.length === 1) {
      setSelectedSubscriptionId(config.eligible_subscriptions[0].id);
    }
  }, [config]);

  // Function to poll for new spin result after Stars payment
  const pollForSpinResult = useCallback(
    async (signal: AbortSignal, maxAttempts = 15, delayMs = 800) => {
      // Wait a bit before first poll to give the bot time to process the payment
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (signal.aborted) return null;

      // Get current history to find the latest spin ID
      let historyBefore;
      try {
        historyBefore = await wheelApi.getHistory(1, 1);
      } catch {
        historyBefore = { items: [], total: 0 };
      }
      const lastSpinIdBefore = historyBefore.items.length > 0 ? historyBefore.items[0].id : 0;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (signal.aborted) return null;

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (signal.aborted) return null;

        try {
          const historyAfter = await wheelApi.getHistory(1, 1);

          // Check if we have a new spin (either new item or higher ID)
          if (historyAfter.items.length > 0) {
            const latestSpin = historyAfter.items[0];
            // If we had no spins before, or this spin has a higher ID
            if (lastSpinIdBefore === 0 || latestSpin.id > lastSpinIdBefore) {
              // Found a new spin! Return it as SpinResult
              return {
                success: true,
                // WheelPrize id — lets the wheel land on the exact won sector.
                // (Was latestSpin.id, the SPIN id, which never matched a sector and
                // forced the random-angle fallback → the fake-win bug.)
                prize_id: latestSpin.prize_id,
                prize_type: latestSpin.prize_type,
                prize_value: latestSpin.prize_value,
                prize_display_name: latestSpin.prize_display_name,
                emoji: latestSpin.emoji,
                color: latestSpin.color,
                rotation_degrees: 0, // Not needed for result display
                message:
                  latestSpin.prize_type === 'nothing'
                    ? t('wheel.noPrize')
                    : `${t('wheel.youWon')} ${latestSpin.prize_display_name}!`,
                promocode: null, // Promocode is sent to bot chat
                error: null,
              } as SpinResult;
            }
          }
        } catch {
          // Continue polling on error
        }
      }

      // Timeout - couldn't find new spin
      return null;
    },
    [t],
  );

  // Ref to store pending Stars payment result
  const pendingStarsResultRef = useRef<SpinResult | null>(null);
  const isStarsSpinRef = useRef(false);
  const pollingAbortRef = useRef<AbortController | null>(null);
  const preOpenedWindowRef = useRef<Window | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingAbortRef.current) {
        pollingAbortRef.current.abort();
      }
    };
  }, []);

  const starsInvoiceMutation = useMutation({
    mutationFn: wheelApi.createStarsInvoice,
    onSuccess: async (data) => {
      // Use platform's openInvoice if available
      if (capabilities.hasInvoice) {
        const status = await openInvoice(data.invoice_url);

        if (status === 'paid') {
          // Mark this as a Stars spin so handleSpinComplete knows to use the pending result
          isStarsSpinRef.current = true;
          pendingStarsResultRef.current = null;

          // Cancel any existing polling
          if (pollingAbortRef.current) {
            pollingAbortRef.current.abort();
          }
          pollingAbortRef.current = new AbortController();

          // Keep isPayingStars=true to show loading state while polling for result.
          // We poll FIRST to get the actual prize, then calculate the correct
          // rotation angle so the wheel visually lands on the right sector.
          const abortSignal = pollingAbortRef.current.signal;
          pollForSpinResult(abortSignal)
            .then((result) => {
              if (abortSignal.aborted) return;

              queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
              queryClient.invalidateQueries({ queryKey: ['wheel-history'] });

              setIsPayingStars(false);

              if (result) {
                pendingStarsResultRef.current = result;
                // Land on the ACTUAL won sector (matched by prize_id).
                setTargetRotation(calculateRotationForPrize(config?.prizes ?? [], result));
              } else {
                // Couldn't get the result — land on the neutral sector (never a
                // random/winning angle) and tell the user to check their history.
                pendingStarsResultRef.current = {
                  success: true,
                  prize_id: null,
                  prize_type: null,
                  prize_value: 0,
                  prize_display_name: '',
                  emoji: '🎰',
                  color: '#8B5CF6',
                  rotation_degrees: 0,
                  message: t('wheel.starsPaymentSuccessCheckHistory'),
                  promocode: null,
                  error: null,
                };
                setTargetRotation(neutralRotation(config?.prizes ?? []));
              }

              setIsSpinning(true);
            })
            .catch(() => {
              if (abortSignal.aborted) return;

              setIsPayingStars(false);

              // Error polling — land on the neutral sector (never a random/winning
              // angle) and show the generic "check your history" message.
              pendingStarsResultRef.current = {
                success: true,
                prize_id: null,
                prize_type: null,
                prize_value: 0,
                prize_display_name: '',
                emoji: '🎰',
                color: '#8B5CF6',
                rotation_degrees: 0,
                message: t('wheel.starsPaymentSuccessCheckHistory'),
                promocode: null,
                error: null,
              };
              setTargetRotation(neutralRotation(config?.prizes ?? []));
              setIsSpinning(true);
            });
        } else if (status !== 'cancelled') {
          setIsPayingStars(false);
          setSpinResult({
            success: false,
            prize_id: null,
            prize_type: null,
            prize_value: 0,
            prize_display_name: '',
            emoji: '😔',
            color: '#EF4444',
            rotation_degrees: 0,
            message: t('wheel.starsPaymentFailed'),
            promocode: null,
            error: 'payment_failed',
          });
        } else {
          setIsPayingStars(false);
        }
      } else {
        // Fallback: redirect pre-opened window to invoice URL
        setIsPayingStars(false);
        if (preOpenedWindowRef.current) {
          preOpenedWindowRef.current.location.href = data.invoice_url;
          preOpenedWindowRef.current = null;
        }
        setSpinResult({
          success: true,
          prize_id: null,
          prize_type: null,
          prize_value: 0,
          prize_display_name: '',
          emoji: '⭐',
          color: '#8B5CF6',
          rotation_degrees: 0,
          message: t('wheel.starsPaymentRedirected'),
          promocode: null,
          error: null,
        });
      }
    },
    onError: () => {
      setIsPayingStars(false);
      if (preOpenedWindowRef.current) {
        preOpenedWindowRef.current.close();
        preOpenedWindowRef.current = null;
      }
      setSpinResult({
        success: false,
        prize_id: null,
        prize_type: null,
        prize_value: 0,
        prize_display_name: '',
        emoji: '😔',
        color: '#EF4444',
        rotation_degrees: 0,
        message: t('wheel.errors.networkError'),
        promocode: null,
        error: 'network_error',
      });
    },
  });

  const handleDirectStarsPay = () => {
    setShowStarsConfirm(false);
    setIsPayingStars(true);
    // In browser: pre-open window synchronously (direct user gesture) to avoid popup blocker
    if (!capabilities.hasInvoice) {
      // Web-only: synchronously pre-open a tab during the user gesture to dodge the
      // popup blocker before the async invoice URL resolves. Not reached in Telegram
      // (hasInvoice is true there, so the native invoice flow is used instead).
      // biome-ignore lint: canonical popup-blocker workaround, see comment above
      preOpenedWindowRef.current = window.open('about:blank', '_blank') || null;
    }
    starsInvoiceMutation.mutate();
  };

  const spinMutation = useMutation({
    mutationFn: () => wheelApi.spin(paymentType, selectedSubscriptionId ?? undefined),
    onSuccess: (result) => {
      if (result.success) {
        setTargetRotation(result.rotation_degrees);
        setSpinResult(result);
      } else {
        setIsSpinning(false);
        setSpinResult(result);
      }
    },
    onError: () => {
      setIsSpinning(false);
      setSpinResult({
        success: false,
        message: t('wheel.errors.networkError'),
        error: 'network_error',
        prize_id: null,
        prize_type: null,
        prize_value: 0,
        prize_display_name: '',
        emoji: '',
        color: '',
        rotation_degrees: 0,
        promocode: null,
      });
    },
  });

  const handleSpin = () => {
    if (!config?.can_spin || isSpinning) return;
    setIsSpinning(true);
    spinMutation.mutate();
  };

  const handleUnifiedSpin = () => {
    if (noSubscription) return;
    if (paymentType === 'telegram_stars') {
      if (!config?.spin_cost_stars_enabled || !config?.spin_cost_stars) {
        notify.warning(t('wheel.starsNotAvailable'));
        return;
      }
      setShowStarsConfirm(true);
    } else {
      handleSpin();
    }
  };

  const handleSpinComplete = useCallback(() => {
    setIsSpinning(false);

    // Check if this was a Stars payment spin
    if (isStarsSpinRef.current) {
      isStarsSpinRef.current = false;

      // Use the pending result from polling, or show a fallback
      if (pendingStarsResultRef.current) {
        setSpinResult(pendingStarsResultRef.current);
        if (pendingStarsResultRef.current.prize_type === 'nothing') {
          haptic.notification('warning');
        } else {
          haptic.notification('success');
        }
        pendingStarsResultRef.current = null;
      } else {
        // Polling still in progress or failed - show fallback
        setSpinResult({
          success: true,
          prize_id: null,
          prize_type: null,
          prize_value: 0,
          prize_display_name: '',
          emoji: '🎰',
          color: '#8B5CF6',
          rotation_degrees: 0,
          message: t('wheel.starsPaymentSuccessCheckHistory'),
          promocode: null,
          error: null,
        });
        haptic.notification('success');
      }
    } else if (spinResult) {
      // Regular spin - haptic based on result
      if (spinResult.success && spinResult.prize_type !== 'nothing') {
        haptic.notification('success');
      } else {
        haptic.notification('warning');
      }
    }

    queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
    queryClient.invalidateQueries({ queryKey: ['wheel-history'] });
  }, [queryClient, t, haptic, spinResult]);

  const closeResultModal = () => {
    setSpinResult(null);
    setTargetRotation(null);
  };

  if (isLoading) {
    return (
      <Page>
        <PageSkeleton titleWidth="w-40" className="space-y-6 pb-8">
          <Skeleton className="h-4 w-56" />
          <Skeleton variant="card" className="h-80 rounded-3xl" />
        </PageSkeleton>
      </Page>
    );
  }

  if (error || !config) {
    return (
      <Page>
        <PageHeader title={t('wheel.title')} noBack />
        <EmptyState icon={<PiWarningCircleDuotone />} title={t('wheel.errors.loadFailed')} />
      </Page>
    );
  }

  if (!config.is_enabled) {
    return (
      <Page>
        <PageHeader title={t('wheel.title')} noBack />
        <EmptyState icon={<PiSpinnerBallDuotone />} title={t('wheel.disabled')} />
      </Page>
    );
  }

  const starsEnabled = config.spin_cost_stars_enabled && config.spin_cost_stars;
  const daysEnabled = config.spin_cost_days_enabled && config.spin_cost_days;
  const bothMethodsAvailable = !!(starsEnabled && daysEnabled);

  // Stars via Telegram invoice don't require ruble balance, so only check daily limit
  const dailyLimitReached = config.daily_limit > 0 && config.user_spins_today >= config.daily_limit;
  const noSubscription = !config.has_subscription;
  const needsSubscriptionPick =
    paymentType === 'subscription_days' &&
    config.eligible_subscriptions &&
    config.eligible_subscriptions.length > 1 &&
    !selectedSubscriptionId;

  const spinDisabled =
    isSpinning ||
    isPayingStars ||
    dailyLimitReached ||
    noSubscription ||
    needsSubscriptionPick ||
    (paymentType === 'telegram_stars' ? !starsEnabled : !config.can_spin);

  const segment = (active: boolean) =>
    cn(
      'flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors',
      active
        ? 'bg-dark-800 text-dark-50 ring-1 ring-inset ring-dark-700/60'
        : 'text-dark-400 hover:text-dark-200',
    );
  const hintWarning =
    'rounded-2xl bg-warning-500/10 p-3 text-center text-sm text-warning-400 ring-1 ring-inset ring-warning-500/25';
  const hintMuted = 'rounded-2xl bg-dark-800/50 p-3 text-center text-sm text-dark-300';

  return (
    <Page className="pb-8">
      <PageHeader
        title={t('wheel.title')}
        noBack
        subtitle={
          config.daily_limit > 0
            ? `${t('wheel.spinsRemaining')}: ${Math.max(0, config.daily_limit - config.user_spins_today)}/${config.daily_limit}`
            : undefined
        }
      />

      {/* Колесо и управление */}
      <Surface className="space-y-5">
        <FortuneWheel
          prizes={config.prizes}
          isSpinning={isSpinning}
          targetRotation={targetRotation}
          onSpinComplete={handleSpinComplete}
        />

        {/* Payment type selector */}
        {(starsEnabled || daysEnabled) && (
          <div>
            <p className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
              {t('wheel.spinCost')}
            </p>
            <div
              className={cn(
                'grid gap-1 rounded-2xl bg-dark-800/40 p-1 ring-1 ring-inset ring-dark-800/80',
                bothMethodsAvailable ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >
              {starsEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentType('telegram_stars')}
                  disabled={isSpinning}
                  aria-pressed={paymentType === 'telegram_stars'}
                  className={segment(paymentType === 'telegram_stars')}
                >
                  {t('wheel.starsCost', {
                    count: config.spin_cost_stars ?? 0,
                    defaultValue: `${config.spin_cost_stars} ⭐`,
                  })}
                </button>
              )}
              {daysEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentType('subscription_days')}
                  disabled={isSpinning}
                  aria-pressed={paymentType === 'subscription_days'}
                  className={segment(paymentType === 'subscription_days')}
                >
                  <PiCalendarDuotone className="h-[18px] w-[18px] text-accent-400" />
                  {t('wheel.days', { count: config.spin_cost_days ?? 0 })}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Subscription selector for days payment in multi-tariff */}
        {paymentType === 'subscription_days' &&
          config.eligible_subscriptions &&
          config.eligible_subscriptions.length > 1 && (
            <div>
              <p className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
                {t('wheel.selectSubscription', 'Выберите подписку')}
              </p>
              <div className="space-y-1.5">
                {config.eligible_subscriptions.map((sub) => (
                  <button
                    type="button"
                    key={sub.id}
                    onClick={() => setSelectedSubscriptionId(sub.id)}
                    disabled={isSpinning}
                    aria-pressed={selectedSubscriptionId === sub.id}
                    className={cn(
                      'flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-4 py-2 text-sm ring-1 ring-inset transition-colors',
                      selectedSubscriptionId === sub.id
                        ? 'bg-accent-500/10 text-dark-50 ring-accent-500/40'
                        : 'bg-dark-800/40 text-dark-200 ring-dark-800/80 hover:bg-dark-800/70',
                    )}
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {sub.tariff_name || t('subscription.defaultName', 'Подписка')}
                    </span>
                    <span className="shrink-0 text-[13px] text-dark-400">
                      {isLifetimePeriod(sub.days_left)
                        ? t('subscription.lifetime.forever')
                        : `${sub.days_left} ${t('common.units.days', 'дней')}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Stars confirmation panel */}
        {showStarsConfirm && !isSpinning && !isPayingStars ? (
          <div className="space-y-3 rounded-2xl bg-accent-500/10 p-4 ring-1 ring-inset ring-accent-500/25">
            <p className="text-center text-sm text-dark-200">{t('wheel.confirmStarsPayment')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button tone="secondary" onClick={() => setShowStarsConfirm(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleDirectStarsPay}>
                {t('wheel.payStars', { count: config.spin_cost_stars ?? 0 })}
              </Button>
            </div>
          </div>
        ) : (
          /* Single Spin Button */
          <Button
            onClick={handleUnifiedSpin}
            disabled={spinDisabled}
            aria-busy={isSpinning || isPayingStars}
            className="w-full"
          >
            {(isSpinning || isPayingStars) && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {isSpinning ? t('wheel.spinning') : t('wheel.spin')}
          </Button>
        )}

        {/* No subscription hint */}
        {!isSpinning && noSubscription && (
          <p className={hintWarning}>{t('wheel.errors.noSubscription')}</p>
        )}
        {/* Cannot spin hint — only show for days payment (Stars via invoice always works) */}
        {!isSpinning && !noSubscription && paymentType !== 'telegram_stars' && !config.can_spin && (
          <p className={hintMuted}>
            {config.can_spin_reason === 'daily_limit_reached'
              ? t('wheel.errors.dailyLimitReached')
              : t('wheel.errors.cannotSpin')}
          </p>
        )}
        {/* Daily limit hint for Stars payment (not covered by can_spin check) */}
        {!isSpinning &&
          !noSubscription &&
          paymentType === 'telegram_stars' &&
          dailyLimitReached && <p className={hintMuted}>{t('wheel.errors.dailyLimitReached')}</p>}
        {/* Subscription selection required hint */}
        {!isSpinning && needsSubscriptionPick && (
          <p className={hintWarning}>
            {t('wheel.errors.selectSubscription', 'Выберите подписку для списания дней')}
          </p>
        )}

        {/* Inline Result Card */}
        {spinResult && !isSpinning && (
          <div
            className={cn(
              'animate-fade-in rounded-2xl p-4 ring-1 ring-inset',
              spinResult.success
                ? 'bg-accent-500/10 ring-accent-500/25'
                : 'bg-error-500/10 ring-error-500/25',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dark-800/70 text-xl">
                {spinResult.success ? spinResult.emoji || '🎉' : '😔'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-dark-100">
                  {spinResult.success && spinResult.prize_display_name
                    ? spinResult.prize_display_name
                    : spinResult.success
                      ? spinResult.prize_type === 'nothing'
                        ? t('wheel.noLuck')
                        : t('wheel.congratulations')
                      : t('wheel.oops')}
                </div>
                <div className="text-[13px] text-dark-400">{spinResult.message}</div>
              </div>
              <button
                type="button"
                onClick={closeResultModal}
                aria-label={t('common.close')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-dark-400 transition-colors hover:bg-dark-800/60 hover:text-dark-200"
              >
                <PiXBold className="h-4 w-4" />
              </button>
            </div>

            {/* Promocode if won */}
            {spinResult.promocode && (
              <div className="mt-3 rounded-2xl bg-dark-900/60 p-3 text-center">
                <p className="mb-1 text-[13px] text-dark-400">{t('wheel.yourPromoCode')}</p>
                <p className="select-all text-lg font-bold tracking-wide text-accent-400">
                  {spinResult.promocode}
                </p>
              </div>
            )}
          </div>
        )}
      </Surface>

      {/* Prize Legend */}
      <section>
        <SectionTitle>{t('wheel.prizes') || 'Призы'}</SectionTitle>
        <WheelLegend prizes={config.prizes} />
      </section>

      {/* History Section - collapsible */}
      <div className="overflow-hidden rounded-3xl bg-dark-900/70 ring-1 ring-inset ring-dark-800/80">
        <Row
          icon={<PiClockCounterClockwiseDuotone />}
          iconTone="muted"
          label={t('wheel.recentSpins')}
          onClick={() => setHistoryExpanded(!historyExpanded)}
          trailing={
            <span className="flex items-center gap-2 text-[13px] text-dark-400">
              {history && history.items.length > 0 && history.items.length}
              <PiCaretDownBold
                className={cn(
                  'h-3.5 w-3.5 text-dark-500 transition-transform duration-200',
                  historyExpanded && 'rotate-180',
                )}
              />
            </span>
          }
        />

        <AnimatePresence>
          {historyExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-dark-800/70">
                {history && history.items.length > 0 ? (
                  // "hidden"/"show" don't exist in staggerContainer/staggerItem
                  // (their keys are initial/animate/exit), so the stagger here
                  // was silently a no-op
                  <motion.div
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                    className="divide-y divide-dark-800/70"
                  >
                    {history.items.map((item: SpinHistoryItem) => (
                      <motion.div
                        key={item.id}
                        variants={staggerItem}
                        className="flex min-h-[60px] items-center gap-3 px-4 py-2.5"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dark-800/80 text-xl">
                          {item.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-semibold text-dark-100">
                            {item.prize_display_name}
                          </div>
                          <div className="text-[13px] text-dark-400">
                            {new Date(item.created_at).toLocaleDateString(uiLocale())}
                          </div>
                        </div>
                        <div className="shrink-0 whitespace-nowrap text-[13px] text-dark-400">
                          -
                          {item.payment_type === 'telegram_stars'
                            ? `${item.payment_amount} ⭐`
                            : `${item.payment_amount}${t('wheel.days').charAt(0)}`}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <p className="px-4 py-6 text-center text-[13px] text-dark-400">
                    {t('wheel.noHistory')}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Page>
  );
}
