import { tariffTrafficLabel } from '../../../utils/tariffTrafficLabel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Chip, SectionTitle, Stat, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage, getInsufficientBalanceError } from '../../../utils/subscriptionHelpers';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from './dailyPrice';
import { customDaysPrice } from './customDaysPrice';
import { usePlatform } from '../../../platform';
import { openPaymentUrl } from '../../../utils/openPaymentUrl';
import { getMonthlyPriceKopeks } from '../../../utils/pricing';
import { isLifetimePeriod } from '../../../utils/lifetime';
import { pickBestValue } from '../../../utils/bestValue';
import InsufficientBalancePrompt from '../../InsufficientBalancePrompt';
import type { Tariff, TariffPeriod } from '../../../types';
import { BestValueBadge, bestValueFrame } from '../BestValueBadge';
import { plainTariffName } from '@/utils/plainTariffName';

// ──────────────────────────────────────────────────────────────────
// TariffPurchaseForm
//
// The full per-tariff purchase form: period picker (or daily-tariff
// activate), custom-days toggle + slider, custom-traffic toggle +
// slider, summary, and the confirm CTA. Self-owns:
//   - the purchaseTariff mutation
//   - the auto-scroll-into-view ref + effect on mount
//   - selectedTariffPeriod / customDays / customTrafficGb /
//     useCustomDays / useCustomTraffic (form-internal state, reset
//     by re-mount when the parent passes a new `tariff` via key=)
//
// The parent (SubscriptionPurchase) supplies the chosen tariff,
// the current balance (for inline insufficient-balance prompts),
// the subscription id (for the renew-this-subscription flow), and
// onBack to clear its own selection state.
// ──────────────────────────────────────────────────────────────────

export interface TariffPurchaseFormProps {
  tariff: Tariff;
  subscriptionId: number | undefined;
  balanceKopeks: number | undefined;
  /** СБП-оформление (Platega recurrent) доступно — показать вторую CTA. */
  sbpPurchaseEnabled?: boolean;
  /** Оформление привязкой Lava доступно — показать вторую CTA. */
  lavaPurchaseEnabled?: boolean;
  /** Оформление привязкой Cashera доступно — показать вторую CTA. */
  casheraPurchaseEnabled?: boolean;
  onBack: () => void;
}

export function TariffPurchaseForm({
  tariff,
  subscriptionId,
  balanceKopeks,
  sbpPurchaseEnabled = false,
  lavaPurchaseEnabled = false,
  casheraPurchaseEnabled = false,
  onBack,
}: TariffPurchaseFormProps) {
  const { t } = useTranslation();
  // Вечный период (ULTIMA, 2222 дня) — «Навсегда», даже если подпись с сервера иная.
  const periodLabel = (period: { days: number; label: string }) =>
    isLifetimePeriod(period.days) ? t('subscription.lifetime.forever') : period.label;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();
  // Та же котировка, что на карточке тарифа: серверная цена + промокод один раз.
  const dailyQuote = dailyPriceQuote(tariff, applyPromoDiscount);
  const customDayUnitPrice =
    tariff.custom_days_pricing?.price_per_day_kopeks ?? tariff.price_per_day_kopeks ?? 0;
  const { openLink, platform } = usePlatform();
  const ref = useRef<HTMLDivElement>(null);
  const checkoutAttempt = useRef<{ signature: string; id: string } | null>(null);

  // Целые суммы без «,00»: «299 ₽», а не «299,00 ₽».
  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100).replace(/[.,]00$/, '')}\u00A0${currencySymbol}`;

  // Form-internal state — seeded from the tariff prop. Resets via
  // `key={tariff.id}` on the parent's render.
  // Отмеченный оператором период выбран сразу: рамка «Выгодно» и итог внизу
  // должны говорить об одном и том же периоде.
  const [selectedTariffPeriod, setSelectedTariffPeriod] = useState<TariffPeriod | null>(
    pickBestValue(tariff.periods) || tariff.periods[0] || null,
  );
  const [customDays, setCustomDays] = useState<number>(30);
  const [customTrafficGb, setCustomTrafficGb] = useState<number>(50);
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [useCustomTraffic, setUseCustomTraffic] = useState(false);

  const purchaseMutation = useMutation({
    mutationFn: () => {
      const isDailyTariff =
        tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0);
      const days = isDailyTariff
        ? 1
        : useCustomDays
          ? customDays
          : selectedTariffPeriod?.days || 30;
      const trafficGb =
        useCustomTraffic && tariff.custom_traffic_enabled ? customTrafficGb : undefined;
      // Forward the subscription_id when the user landed here via the
      // "Renew this subscription" flow (?subscriptionId=N). The backend
      // uses it to resolve the exact target row by ID, avoiding the
      // race with concurrent panel webhooks that would otherwise hit
      // the partial UNIQUE on uq_subscriptions_user_tariff_active.
      if (isDailyTariff) {
        return subscriptionApi.purchaseTariff(tariff.id, days, trafficGb, subscriptionId);
      }
      const signature = JSON.stringify([tariff.id, days, trafficGb, subscriptionId]);
      if (checkoutAttempt.current?.signature !== signature) {
        // A retry keeps its identity even if the balance or quote was refreshed.
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        checkoutAttempt.current = { signature, id };
      }
      return subscriptionApi.purchaseTariff(
        tariff.id,
        days,
        trafficGb,
        subscriptionId,
        checkoutAttempt.current.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      navigate('/subscriptions', { replace: true });
    },
  });

  // СБП-оформление: первое списание = подтверждение привязки в банке; период
  // на форме не участвует — списания идут по каденс-правилу тарифа.
  const sbpPurchaseMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.purchaseWithSbpRecurring(tariff.id, subscriptionId ?? undefined),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['sbp-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const sbpPurchaseButton = sbpPurchaseEnabled && (
    <>
      <button
        onClick={() => sbpPurchaseMutation.mutate()}
        disabled={sbpPurchaseMutation.isPending || purchaseMutation.isPending}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-dark-800/70 text-[15px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/70 disabled:opacity-50"
      >
        <span className="flex items-center justify-center gap-2">
          {sbpPurchaseMutation.isPending && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {t('subscription.sbpRecurring.purchaseButton')}
        </span>
      </button>
      <div className="mt-1.5 text-center text-[13px] text-dark-500">
        {t('subscription.sbpRecurring.purchaseHint')}
      </div>
      {sbpPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-error-400">
          {getErrorMessage(sbpPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  const lavaPurchaseMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.purchaseWithLavaRecurring(tariff.id, subscriptionId ?? undefined),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['lava-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const lavaPurchaseButton = lavaPurchaseEnabled && (
    <>
      <button
        onClick={() => lavaPurchaseMutation.mutate()}
        disabled={lavaPurchaseMutation.isPending || purchaseMutation.isPending}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-dark-800/70 text-[15px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/70 disabled:opacity-50"
      >
        <span className="flex items-center justify-center gap-2">
          {lavaPurchaseMutation.isPending && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {t('subscription.lavaRecurring.purchaseButton')}
        </span>
      </button>
      <div className="mt-1.5 text-center text-[13px] text-dark-500">
        {t('subscription.lavaRecurring.purchaseHint')}
      </div>
      {lavaPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-error-400">
          {getErrorMessage(lavaPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  const casheraPurchaseMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.purchaseWithCasheraRecurring(tariff.id, subscriptionId ?? undefined),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['cashera-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const casheraPurchaseButton = casheraPurchaseEnabled && (
    <>
      <button
        onClick={() => casheraPurchaseMutation.mutate()}
        disabled={casheraPurchaseMutation.isPending || purchaseMutation.isPending}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-dark-800/70 text-[15px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/70 disabled:opacity-50"
      >
        <span className="flex items-center justify-center gap-2">
          {casheraPurchaseMutation.isPending && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {t('subscription.casheraRecurring.purchaseButton')}
        </span>
      </button>
      <div className="mt-1.5 text-center text-[13px] text-dark-500">
        {t('subscription.casheraRecurring.purchaseHint')}
      </div>
      {casheraPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-error-400">
          {getErrorMessage(casheraPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  // Smooth scroll the form into view when first mounted.
  useEffect(() => {
    if (ref.current) {
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const isDailyTariff = Boolean(
    tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0),
  );
  const discountChip = (percent: number | null | undefined, isPromoGroup?: boolean) =>
    percent != null && percent > 0 ? (
      <Chip tone={isPromoGroup ? 'success' : 'warning'}>-{percent}%</Chip>
    ) : null;
  const switchClass = (on: boolean) =>
    cn(
      "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 before:absolute before:-inset-2 before:content-['']",
      on ? 'bg-accent-500' : 'bg-dark-700',
    );
  const knob = (on: boolean) => (
    <span
      className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-transform duration-200"
      style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
    />
  );
  const numberInput =
    'w-20 rounded-xl bg-dark-800 px-3 py-2 text-center text-[15px] text-dark-100 outline-none focus:ring-accent-500';

  return (
    <div ref={ref} className="space-y-6">
      {/* Тариф: название, что входит, «другой тариф» */}
      <Surface>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-dark-400">
              {t('subscription.baseTariff', 'Тариф')}
            </p>
            <h3 className="mt-0.5 truncate text-xl font-bold tracking-tight text-dark-50">
              {plainTariffName(tariff.name)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-xl px-2 py-1 text-[13px] font-medium text-accent-400 transition-colors hover:bg-accent-500/10"
          >
            {t('subscription.chooseDifferentTariff')}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[13px] text-dark-300">
          <span className="rounded-full bg-dark-800/60 px-2.5 py-1">
            {t('subscription.traffic')}: {tariffTrafficLabel(tariff.traffic_limit_gb, t)}
          </span>
          <span className="rounded-full bg-dark-800/60 px-2.5 py-1">
            {t('subscription.devices')}: {tariff.device_limit === 0 ? '∞' : tariff.device_limit}
            {tariff.extra_devices_count > 0 && (
              <span className="ml-1 text-accent-400">(+{tariff.extra_devices_count})</span>
            )}
          </span>
        </div>
      </Surface>

      {isDailyTariff ? (
        /* Суточный тариф: цена за день и одна кнопка */
        <Surface className="space-y-4">
          <Stat
            label={t('subscription.dailyPurchase.costPerDay')}
            value={formatPrice(dailyQuote?.price ?? 0)}
            hint={
              dailyQuote?.original && dailyQuote.original > dailyQuote.price ? (
                <span className="flex items-center gap-2">
                  <span className="line-through">{formatPrice(dailyQuote.original)}</span>
                  {discountChip(dailyQuote.percent, dailyQuote.isPromoGroup)}
                </span>
              ) : undefined
            }
          />
          <ul className="space-y-1.5 text-[13px] leading-snug text-dark-400">
            <li>{t('subscription.dailyPurchase.chargedDaily')}</li>
            <li>{t('subscription.dailyPurchase.canPause')}</li>
            <li>{t('subscription.dailyPurchase.pausedOnLowBalance')}</li>
          </ul>

          {(() => {
            const dailyPrice = dailyQuote?.price ?? 0;
            const hasEnoughBalance = balanceKopeks !== undefined && dailyPrice <= balanceKopeks;

            return (
              <div>
                {balanceKopeks !== undefined && !hasEnoughBalance && (
                  <InsufficientBalancePrompt
                    missingAmountKopeks={dailyPrice - balanceKopeks}
                    compact
                    className="mb-4"
                  />
                )}

                <Button
                  className="w-full"
                  onClick={() => purchaseMutation.mutate()}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  {t('subscription.dailyPurchase.activate', {
                    price: formatPrice(dailyPrice),
                  })}
                </Button>

                {sbpPurchaseButton}
                {lavaPurchaseButton}
                {casheraPurchaseButton}

                {purchaseMutation.isError &&
                  !getInsufficientBalanceError(purchaseMutation.error) && (
                    <div className="mt-3 text-center text-[13px] text-error-400">
                      {getErrorMessage(purchaseMutation.error)}
                    </div>
                  )}
                {purchaseMutation.isError &&
                  getInsufficientBalanceError(purchaseMutation.error) && (
                    <div className="mt-3">
                      <InsufficientBalancePrompt
                        missingAmountKopeks={
                          getInsufficientBalanceError(purchaseMutation.error)?.missingAmount ||
                          dailyPrice - (balanceKopeks || 0)
                        }
                        compact
                      />
                    </div>
                  )}
              </div>
            );
          })()}
        </Surface>
      ) : (
        <>
          {/* Период */}
          <section>
            <SectionTitle>{t('subscription.selectPeriod')}</SectionTitle>

            {tariff.periods.length > 0 && !useCustomDays && (
              <div className="space-y-2">
                {tariff.periods.map((period) => {
                  const promoPeriod = applyPromoDiscount(
                    period.price_kopeks,
                    period.original_price_kopeks,
                  );
                  const displayOriginal = promoPeriod.original;
                  const displayPrice = promoPeriod.price;
                  const displayPerMonth = isLifetimePeriod(period.days)
                    ? null
                    : getMonthlyPriceKopeks(displayPrice, period.days);
                  const isSelectedPeriod =
                    selectedTariffPeriod?.days === period.days && !useCustomDays;

                  return (
                    <button
                      key={period.days}
                      type="button"
                      aria-pressed={isSelectedPeriod}
                      onClick={() => {
                        setSelectedTariffPeriod(period);
                        setUseCustomDays(false);
                      }}
                      className={cn(
                        'flex min-h-[64px] w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition-colors',
                        period.is_highlighted
                          ? `${bestValueFrame(isSelectedPeriod)} ${isSelectedPeriod ? 'bg-accent-500/15' : 'bg-dark-900/70'}`
                          : isSelectedPeriod
                            ? 'bg-accent-500/15'
                            : 'bg-dark-900/70 hover:bg-dark-800/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                          isSelectedPeriod ? 'bg-accent-500' : 'bg-dark-700',
                        )}
                        aria-hidden
                      >
                        {isSelectedPeriod && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-dark-100">
                            {periodLabel(period)}
                          </span>
                          {period.is_highlighted && <BestValueBadge />}
                          {discountChip(promoPeriod.percent, promoPeriod.isPromoGroup)}
                        </span>
                        {displayPerMonth !== null && (
                          <span className="mt-0.5 block text-[13px] text-dark-400">
                            {formatPrice(displayPerMonth)}/{t('subscription.month')}
                          </span>
                        )}
                      </span>
                      {/* Цена не рвётся между числом и знаком валюты. */}
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-dark-50">
                          {formatPrice(displayPrice)}
                        </span>
                        {displayOriginal && displayOriginal > displayPrice && (
                          <span className="whitespace-nowrap text-[13px] text-dark-500 line-through">
                            {formatPrice(displayOriginal)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* No periods available fallback */}
            {tariff.periods.length === 0 &&
              !useCustomDays &&
              !(tariff.custom_days_enabled && customDayUnitPrice > 0) && (
                <Surface className="bg-warning-500/5 text-center">
                  <p className="text-[15px] font-semibold text-warning-400">
                    {t('subscription.noPeriodsAvailable')}
                  </p>
                  <p className="mt-1 text-[13px] text-dark-400">
                    {t('subscription.noPeriodsAvailableHint')}
                  </p>
                  <Button tone="secondary" className="mt-4" onClick={onBack}>
                    {t('subscription.chooseDifferentTariff')}
                  </Button>
                </Surface>
              )}

            {/* Свой срок */}
            {tariff.custom_days_enabled && customDayUnitPrice > 0 && (
              <Surface className="mt-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-dark-100">
                    {t('subscription.customDays.title')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseCustomDays(!useCustomDays)}
                    role="switch"
                    aria-checked={useCustomDays}
                    aria-label={t('subscription.customDays.title')}
                    className={switchClass(useCustomDays)}
                  >
                    {knob(useCustomDays)}
                  </button>
                </div>
                {useCustomDays && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={tariff.min_days ?? 1}
                        max={tariff.max_days ?? 365}
                        value={customDays}
                        onChange={(e) => setCustomDays(parseInt(e.target.value))}
                        className="min-w-0 flex-1 accent-accent-500"
                      />
                      <input
                        type="number"
                        value={customDays}
                        min={tariff.min_days ?? 1}
                        max={tariff.max_days ?? 365}
                        onChange={(e) =>
                          setCustomDays(
                            Math.max(
                              tariff.min_days ?? 1,
                              Math.min(
                                tariff.max_days ?? 365,
                                parseInt(e.target.value) || (tariff.min_days ?? 1),
                              ),
                            ),
                          )
                        }
                        className={numberInput}
                      />
                    </div>
                    {(() => {
                      const { price: basePrice, original: existingOriginal } = customDaysPrice(
                        tariff,
                        customDays,
                      );
                      const promoCustom = applyPromoDiscount(basePrice, existingOriginal);
                      return (
                        <div className="flex flex-wrap justify-between gap-x-3 text-[13px]">
                          {/* «/день» — уже в переводе; второй «/» давал «₽//день». */}
                          <span className="text-dark-400">
                            {t('subscription.days', { count: customDays })} ×{' '}
                            <span className="whitespace-nowrap">
                              {formatPrice(customDayUnitPrice)}
                              {t('subscription.customDays.perDay')}
                            </span>
                            {tariff.extra_devices_count > 0 && (
                              <span className="block">
                                + {t('subscription.extraDevices')} ({tariff.extra_devices_count})
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="font-semibold text-dark-50">
                              {formatPrice(promoCustom.price)}
                            </span>
                            {promoCustom.original && promoCustom.original > promoCustom.price && (
                              <>
                                <span className="text-dark-500 line-through">
                                  {formatPrice(promoCustom.original)}
                                </span>
                                {discountChip(promoCustom.percent, promoCustom.isPromoGroup)}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Surface>
            )}
          </section>

          {/* Свой объём трафика */}
          {tariff.custom_traffic_enabled && (tariff.traffic_price_per_gb_kopeks ?? 0) > 0 && (
            <section>
              <SectionTitle>{t('subscription.customTraffic.label')}</SectionTitle>
              <Surface>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-dark-100">
                    {t('subscription.customTraffic.selectVolume')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseCustomTraffic(!useCustomTraffic)}
                    role="switch"
                    aria-checked={useCustomTraffic}
                    aria-label={t('subscription.customTraffic.selectVolume')}
                    className={switchClass(useCustomTraffic)}
                  >
                    {knob(useCustomTraffic)}
                  </button>
                </div>
                {!useCustomTraffic && (
                  <p className="mt-1 text-[13px] text-dark-400">
                    {t('subscription.customTraffic.default', {
                      label: tariffTrafficLabel(tariff.traffic_limit_gb, t),
                    })}
                  </p>
                )}
                {useCustomTraffic && (
                  <div className="mt-4 space-y-3">
                    {/* Ползунок сжимается, поле с «ГБ» — нет. */}
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={tariff.min_traffic_gb ?? 1}
                        max={tariff.max_traffic_gb ?? 1000}
                        value={customTrafficGb}
                        onChange={(e) => setCustomTrafficGb(parseInt(e.target.value))}
                        className="min-w-0 flex-1 accent-accent-500"
                      />
                      <div className="flex shrink-0 items-center gap-2">
                        <input
                          type="number"
                          value={customTrafficGb}
                          min={tariff.min_traffic_gb ?? 1}
                          max={tariff.max_traffic_gb ?? 1000}
                          onChange={(e) =>
                            setCustomTrafficGb(
                              Math.max(
                                tariff.min_traffic_gb ?? 1,
                                Math.min(
                                  tariff.max_traffic_gb ?? 1000,
                                  parseInt(e.target.value) || (tariff.min_traffic_gb ?? 1),
                                ),
                              ),
                            )
                          }
                          className={numberInput}
                        />
                        <span className="text-dark-400">{t('common.units.gb')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 text-[13px]">
                      <span className="text-dark-400">
                        {customTrafficGb} {t('common.units.gb')} ×{' '}
                        <span className="whitespace-nowrap">
                          {formatPrice(tariff.traffic_price_per_gb_kopeks ?? 0)}/
                          {t('common.units.gb')}
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-semibold text-dark-50">
                        +{formatPrice(customTrafficGb * (tariff.traffic_price_per_gb_kopeks ?? 0))}
                      </span>
                    </div>
                  </div>
                )}
              </Surface>
            </section>
          )}

          {/* Итог и оплата */}
          {(selectedTariffPeriod || useCustomDays) && (
            <Surface>
              {(() => {
                const customQuote = customDaysPrice(tariff, customDays);
                const basePeriodPrice = useCustomDays
                  ? customQuote.price
                  : selectedTariffPeriod?.price_kopeks || 0;
                const existingPeriodOriginal = useCustomDays
                  ? customQuote.original
                  : selectedTariffPeriod?.original_price_kopeks &&
                      selectedTariffPeriod.original_price_kopeks > selectedTariffPeriod.price_kopeks
                    ? selectedTariffPeriod.original_price_kopeks
                    : undefined;
                const promoPeriod = applyPromoDiscount(basePeriodPrice, existingPeriodOriginal);

                const trafficPrice =
                  useCustomTraffic && tariff.custom_traffic_enabled
                    ? customTrafficGb * (tariff.traffic_price_per_gb_kopeks ?? 0)
                    : 0;

                const totalPrice = promoPeriod.price + trafficPrice;
                const originalTotal = promoPeriod.original
                  ? promoPeriod.original + trafficPrice
                  : null;

                const line = (label: ReactNode, value: ReactNode, key?: string) => (
                  <div
                    key={key}
                    className="flex flex-wrap justify-between gap-x-3 text-[14px] text-dark-300"
                  >
                    <span>{label}</span>
                    <span className="flex items-center gap-2 whitespace-nowrap">{value}</span>
                  </div>
                );
                const struck = (v?: number | null) =>
                  v ? (
                    <span className="text-[13px] text-dark-500 line-through">{formatPrice(v)}</span>
                  ) : null;

                return (
                  <>
                    <div className="space-y-2">
                      {useCustomDays
                        ? line(
                            `${t('subscription.stepPeriod')}: ${t('subscription.days', { count: customDays })}`,
                            <>
                              {formatPrice(promoPeriod.price)}
                              {promoPeriod.original &&
                                promoPeriod.original > promoPeriod.price &&
                                struck(promoPeriod.original)}
                            </>,
                          )
                        : selectedTariffPeriod &&
                          ((selectedTariffPeriod.extra_devices_count ?? 0) > 0 &&
                          selectedTariffPeriod.base_tariff_price_kopeks ? (
                            <>
                              {line(
                                `${t('subscription.baseTariff')}: ${periodLabel(selectedTariffPeriod)}`,
                                formatPrice(selectedTariffPeriod.base_tariff_price_kopeks),
                              )}
                              {line(
                                `${t('subscription.extraDevices')} (${selectedTariffPeriod.extra_devices_count})`,
                                `+${formatPrice(selectedTariffPeriod.extra_devices_cost_kopeks ?? 0)}`,
                              )}
                            </>
                          ) : (
                            line(
                              t('subscription.summary.period', {
                                label: periodLabel(selectedTariffPeriod),
                              }),
                              <>
                                {formatPrice(promoPeriod.price)}
                                {promoPeriod.original &&
                                  promoPeriod.original > promoPeriod.price &&
                                  struck(promoPeriod.original)}
                              </>,
                            )
                          ))}
                      {useCustomTraffic &&
                        tariff.custom_traffic_enabled &&
                        line(
                          t('subscription.summary.traffic', { gb: customTrafficGb }),
                          `+${formatPrice(trafficPrice)}`,
                        )}
                    </div>

                    {promoPeriod.percent ? (
                      <p className="mt-3 rounded-2xl bg-warning-500/10 px-3 py-2 text-center text-[13px] font-medium text-warning-400">
                        {t('promo.discountApplied')} -{promoPeriod.percent}%
                      </p>
                    ) : null}

                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-dark-800/70 pt-4">
                      <span className="text-[15px] font-medium text-dark-300">
                        {t('subscription.total')}
                      </span>
                      <div className="text-right">
                        <span className="whitespace-nowrap text-[26px] font-bold leading-tight tracking-tight text-dark-50">
                          {formatPrice(totalPrice)}
                        </span>
                        {originalTotal && (
                          <div className="text-[13px] text-dark-500 line-through">
                            {formatPrice(originalTotal)}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      className="mt-4 w-full"
                      onClick={() => purchaseMutation.mutate()}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      )}
                      {t('subscription.purchase')}
                    </Button>

                    {sbpPurchaseButton}
                    {lavaPurchaseButton}
                    {casheraPurchaseButton}
                  </>
                );
              })()}

              {purchaseMutation.isError && !getInsufficientBalanceError(purchaseMutation.error) && (
                <div className="mt-3 text-center text-[13px] text-error-400">
                  {getErrorMessage(purchaseMutation.error)}
                </div>
              )}
              {purchaseMutation.isError && getInsufficientBalanceError(purchaseMutation.error) && (
                <div className="mt-3">
                  <InsufficientBalancePrompt
                    missingAmountKopeks={
                      getInsufficientBalanceError(purchaseMutation.error)?.missingAmount || 0
                    }
                    compact
                  />
                </div>
              )}
            </Surface>
          )}
        </>
      )}
    </div>
  );
}
