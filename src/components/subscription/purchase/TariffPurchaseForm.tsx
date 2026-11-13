import { tariffTrafficLabel } from '../../../utils/tariffTrafficLabel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Chip, SectionTitle, Stat, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
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
import { formatPeriodLabel } from '../../../utils/periodLabel';
import { pickBestValue } from '../../../utils/bestValue';
import InsufficientBalancePrompt from '../../InsufficientBalancePrompt';
import type { Tariff, TariffPeriod } from '../../../types';
import { PeriodList } from '../PeriodList';
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
  /** Срок, с которым человек ушёл пополнять баланс (?period= в адресе): после
   * возврата выбран он, а не «выгодный» по умолчанию — иначе пополнивший ровно
   * на свой срок видел «не хватает» за другой. */
  initialPeriodDays?: number | null;
  onBack: () => void;
}

export function TariffPurchaseForm({
  tariff,
  subscriptionId,
  balanceKopeks,
  sbpPurchaseEnabled = false,
  initialPeriodDays = null,
  onBack,
}: TariffPurchaseFormProps) {
  const { t } = useTranslation();
  // Срок словами («3 месяца», «Навсегда»), а не подписью с сервера («90 дней»).
  const periodLabel = (period: { days: number }) => formatPeriodLabel(period.days, t);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { formatMoney } = useCurrency();
  const { applyPromoDiscount, periodQuote } = usePromoDiscount();
  // Та же котировка, что на карточке тарифа: серверная цена + промокод один раз.
  const dailyQuote = dailyPriceQuote(tariff, applyPromoDiscount);
  const customDayUnitPrice =
    tariff.custom_days_pricing?.price_per_day_kopeks ?? tariff.price_per_day_kopeks ?? 0;
  const { openLink, platform } = usePlatform();
  const ref = useRef<HTMLDivElement>(null);
  const checkoutAttempt = useRef<{ signature: string; id: string } | null>(null);

  // Целые суммы без «,00»: «299 ₽», а не «299,00 ₽».
  const formatPrice = (kopeks: number) =>
    kopeks === 0 ? t('subscription.free', 'Бесплатно') : formatMoney(kopeks / 100);

  // Form-internal state — seeded from the tariff prop. Resets via
  // `key={tariff.id}` on the parent's render.
  // Отмеченный оператором период выбран сразу: рамка «Выгодно» и итог внизу
  // должны говорить об одном и том же периоде.
  const [selectedTariffPeriod, setSelectedTariffPeriod] = useState<TariffPeriod | null>(
    (initialPeriodDays ? tariff.periods.find((p) => p.days === initialPeriodDays) : undefined) ||
      pickBestValue(tariff.periods) ||
      tariff.periods[0] ||
      null,
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

  // Smooth scroll the form into view when first mounted. К началу формы, а не к её
  // середине: на маленьком экране середина прятала название тарифа за верхним краем,
  // а кнопка оплаты теперь и так прижата к низу.
  useEffect(() => {
    if (ref.current) {
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const isDailyTariff = Boolean(
    tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0),
  );
  // Куда вернуть после пополнения: эта же витрина с выбранным тарифом и сроком.
  // Без этого после оплаты тариф приходилось выбирать заново, а срок сбрасывался
  // на «выгодный» — и пополнивший ровно на 1 месяц видел «не хватает» за 3.
  const topUpReturnTo = (() => {
    const params = new URLSearchParams(location.search);
    params.set('tariff', String(tariff.id));
    if (!isDailyTariff && !useCustomDays && selectedTariffPeriod) {
      params.set('period', String(selectedTariffPeriod.days));
    } else {
      params.delete('period');
    }
    return `${location.pathname}?${params.toString()}`;
  })();
  const discountChip = (percent: number | null | undefined, isPromoGroup?: boolean) =>
    percent != null && percent > 0 ? (
      <Chip tone={isPromoGroup ? 'success' : 'warning'}>-{percent}%</Chip>
    ) : null;
  // Цена месяца с учётом скидки человека — от неё считаем выгоду длинных сроков.
  const monthlyPeriod = tariff.periods.find((period) => period.days === 30);
  const monthlyPriceKopeks = monthlyPeriod ? periodQuote(monthlyPeriod).price : null;
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

  // Итог выбранного срока: нужен и блоку «Итог», и прижатой к низу кнопке оплаты.
  const quote = (() => {
    if (isDailyTariff || !(selectedTariffPeriod || useCustomDays)) return null;
    // Готовый срок — цена сервера как есть: персональная скидка уже в ней, и ровно
    // столько спишет покупка. «Свой срок» сервер отдаёт без неё — накладываем здесь.
    const customQuote = customDaysPrice(tariff, customDays);
    const promoPeriod =
      useCustomDays || !selectedTariffPeriod
        ? applyPromoDiscount(customQuote.price, customQuote.original)
        : periodQuote(selectedTariffPeriod);
    const customTraffic = useCustomTraffic && Boolean(tariff.custom_traffic_enabled);
    const trafficPrice = customTraffic
      ? customTrafficGb * (tariff.traffic_price_per_gb_kopeks ?? 0)
      : 0;
    const totalPrice = promoPeriod.price + trafficPrice;
    // Баланса не хватает: кнопка сразу ведёт на оплату недостающей суммы и
    // возвращает к этому тарифу и сроку — как на продлении. Раньше «Купить»
    // сначала отвечала ошибкой, и только потом появлялась «Пополнить».
    const shortKopeks =
      balanceKopeks !== undefined && totalPrice > 0 ? Math.max(0, totalPrice - balanceKopeks) : 0;
    const shortRubles = Math.ceil(shortKopeks / 100);
    const extraDevices =
      !useCustomDays &&
      (selectedTariffPeriod?.extra_devices_count ?? 0) > 0 &&
      Boolean(selectedTariffPeriod?.base_tariff_price_kopeks);
    const discounted =
      Boolean(promoPeriod.percent) ||
      Boolean(promoPeriod.original && promoPeriod.original > promoPeriod.price);
    return {
      promoPeriod,
      customTraffic,
      trafficPrice,
      totalPrice,
      shortKopeks,
      shortRubles,
      originalTotal: promoPeriod.original ? promoPeriod.original + trafficPrice : null,
      extraDevices,
      // Состав суммы показываем, когда она из чего-то складывается или есть скидка.
      // Один срок без добавок уже стоит в списке, а сумма — на кнопке.
      detailed: useCustomDays || extraDevices || customTraffic || discounted,
      // Если на балансе есть деньги, говорим, сколько из них уйдёт: на кнопке — только доплата.
      balanceNote:
        balanceKopeks === undefined || totalPrice === 0 || balanceKopeks < 100
          ? null
          : shortKopeks > 0
            ? t('subscription.v10.fromBalancePart', '{{amount}} спишется с баланса', {
                amount: formatMoney((totalPrice - shortRubles * 100) / 100, { round: true }),
              })
            : t('subscription.v10.fromBalanceFull', 'Спишется с баланса — на нём {{amount}}', {
                amount: formatMoney(balanceKopeks / 100),
              }),
    };
  })();
  const goTopUp = () => {
    if (!quote) return;
    const params = new URLSearchParams();
    params.set('amount', String(quote.shortRubles));
    params.set('returnTo', topUpReturnTo);
    navigate(`/balance/top-up?${params.toString()}`);
  };

  return (
    <div ref={ref} className="scroll-mt-3 space-y-6">
      {/* Тариф: название, что входит, «другой тариф» */}
      <Surface>
        {/* «Другой тариф» стоит в строке подписи, а не рядом с названием: на телефоне
            360 px ссылка съедала ширину, и название обрезалось до «Стандартн…». */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-dark-400">
            {t('subscription.baseTariff', 'Тариф')}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="-my-1 -mr-2 shrink-0 rounded-xl px-2 py-1 text-[13px] font-medium text-accent-400 transition-colors hover:bg-accent-500/10"
          >
            {t('subscription.chooseDifferentTariff')}
          </button>
        </div>
        <h3 className="mt-0.5 text-xl font-bold tracking-tight text-dark-50">
          {plainTariffName(tariff.name)}
        </h3>
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
                    returnTo={topUpReturnTo}
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
                        returnTo={topUpReturnTo}
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
              <PeriodList
                selectedDays={selectedTariffPeriod?.days ?? null}
                onSelect={(days) => {
                  const period = tariff.periods.find((item) => item.days === days);
                  if (!period) return;
                  setSelectedTariffPeriod(period);
                  setUseCustomDays(false);
                }}
                items={tariff.periods.map((period) => {
                  const promoPeriod = periodQuote(period);
                  const displayOriginal = promoPeriod.original;
                  const displayPrice = promoPeriod.price;
                  // За месяц и короче «в месяц» повторяло бы саму цену.
                  const displayPerMonth =
                    isLifetimePeriod(period.days) || period.days <= 31
                      ? null
                      : getMonthlyPriceKopeks(displayPrice, period.days);
                  // Выгода против помесячной оплаты, целыми рублями вниз — как на продлении.
                  const saving =
                    monthlyPriceKopeks !== null && displayPerMonth !== null
                      ? Math.floor(
                          Math.max(
                            0,
                            monthlyPriceKopeks * Math.round(period.days / 30) - displayPrice,
                          ) / 100,
                        ) * 100
                      : 0;
                  return {
                    days: period.days,
                    label: periodLabel(period),
                    best: Boolean(period.is_highlighted),
                    discount: discountChip(promoPeriod.percent, promoPeriod.isPromoGroup),
                    // «В месяц» и выгода — целыми рублями, как на продлении: «140 ₽», не «139,50 ₽».
                    perMonth:
                      displayPerMonth !== null
                        ? formatMoney(displayPerMonth / 100, { round: true })
                        : null,
                    saving: saving > 0 ? formatMoney(saving / 100, { round: true }) : null,
                    price: formatPrice(displayPrice),
                    original:
                      displayOriginal && displayOriginal > displayPrice
                        ? formatPrice(displayOriginal)
                        : null,
                  };
                })}
              />
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
                        onChange={(e) => setCustomDays(parseInt(e.target.value, 10))}
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
                                parseInt(e.target.value, 10) || (tariff.min_days ?? 1),
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
                        onChange={(e) => setCustomTrafficGb(parseInt(e.target.value, 10))}
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
                                  parseInt(e.target.value, 10) || (tariff.min_traffic_gb ?? 1),
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

          {/* Итог: состав суммы, ошибки оплаты и второй способ оплаты */}
          {quote && (quote.detailed || sbpPurchaseEnabled || purchaseMutation.isError) && (
            <Surface>
              {quote.detailed &&
                (() => {
                  const { promoPeriod, trafficPrice, totalPrice, originalTotal } = quote;
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
                      <span className="text-[13px] text-dark-500 line-through">
                        {formatPrice(v)}
                      </span>
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
                            (quote.extraDevices ? (
                              <>
                                {line(
                                  `${t('subscription.baseTariff')}: ${periodLabel(selectedTariffPeriod)}`,
                                  formatPrice(selectedTariffPeriod.base_tariff_price_kopeks ?? 0),
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
                        {quote.customTraffic &&
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
                    </>
                  );
                })()}

              {sbpPurchaseButton}

              {purchaseMutation.isError && !getInsufficientBalanceError(purchaseMutation.error) && (
                <div className="mt-3 text-center text-[13px] text-error-400">
                  {getErrorMessage(purchaseMutation.error)}
                </div>
              )}
              {purchaseMutation.isError && getInsufficientBalanceError(purchaseMutation.error) && (
                <div className="mt-3">
                  <InsufficientBalancePrompt
                    returnTo={topUpReturnTo}
                    missingAmountKopeks={
                      getInsufficientBalanceError(purchaseMutation.error)?.missingAmount || 0
                    }
                    compact
                  />
                </div>
              )}
            </Surface>
          )}

          {/* Кнопка оплаты прижата к низу экрана — как на продлении: на телефоне 360×640
              она стояла на 656-й точке, ниже края, и после выбора тарифа её не было видно.
              Над ней — сколько уйдёт с баланса, если на нём есть деньги. На широком
              экране — в потоке. */}
          {quote && (
            <>
              <div className="h-[104px] lg:hidden" aria-hidden />
              <div
                data-pay-bar
                className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-dark-950 from-70% to-transparent px-4 pb-[calc(var(--mobile-nav-clearance)+2px)] pt-5 lg:static lg:z-auto lg:bg-none lg:p-0"
              >
                <div className="mx-auto w-full max-w-[600px]">
                  {quote.balanceNote && (
                    <p className="pb-2.5 text-center text-sm text-dark-400">{quote.balanceNote}</p>
                  )}
                  <Button
                    className="h-[54px] w-full text-[16.5px]"
                    onClick={() => (quote.shortKopeks > 0 ? goTopUp() : purchaseMutation.mutate())}
                    disabled={purchaseMutation.isPending}
                  >
                    {purchaseMutation.isPending && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    {quote.shortKopeks > 0
                      ? t('subscription.v10.payShort', 'Оплатить {{amount}}', {
                          amount: formatMoney(quote.shortRubles, { round: true }),
                        })
                      : quote.totalPrice > 0
                        ? t('subscription.v10.buyFor', 'Купить за {{amount}}', {
                            amount: formatPrice(quote.totalPrice),
                          })
                        : t('subscription.purchase')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
