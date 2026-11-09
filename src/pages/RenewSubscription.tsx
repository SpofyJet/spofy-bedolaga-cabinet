import { isLifetimePeriod, isLifetimeSubscription } from '@/utils/lifetime';
import { isUncertainPurchaseOutcome } from '@/utils/api-error';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { getMonthlyPriceKopeks } from '../utils/pricing';
import { pickBestValue } from '../utils/bestValue';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '../platform';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { BestValueBadge, bestValueFrame } from '../components/subscription/BestValueBadge';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Chip, EmptyState, Page, SectionTitle, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import { PiCalendarXDuotone, PiInfinityDuotone } from 'react-icons/pi';
import { PageSkeleton, Skeleton } from '../components/ui/skeleton';
import { DailyPausePanel } from '../components/subscription/manage/DailyPausePanel';
import { canOpenTariffSwitch, needsTariff, tariffSelectionPath } from '../utils/legacySubscription';
import { plainTariffName } from '@/utils/plainTariffName';

export default function RenewSubscription() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  // ?period=90 — период, выбранный на странице «Баланс»
  const [searchParams] = useSearchParams();
  const requestedPeriod = Number(searchParams.get('period')) || null;
  const subId = subscriptionId ? Number(subscriptionId) : undefined;

  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatMoney } = useCurrency();
  const { impact } = useHaptic();

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load subscription detail for tariff name
  const { data: subscriptionResponse, isLoading: isSubscriptionLoading } = useQuery({
    queryKey: ['subscription', subId],
    queryFn: () => subscriptionApi.getSubscription(subId),
    enabled: !!subId,
    staleTime: 30_000,
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // Load renewal options
  const { data: options, isLoading } = useQuery({
    queryKey: ['renewal-options', subId],
    queryFn: () => subscriptionApi.getRenewalOptions(subId),
    enabled:
      !!subId &&
      !!subscription &&
      !subscription.is_trial &&
      !(subscription.is_daily && !subscription.is_trial),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Отмеченный оператором вариант выбираем сразу, как только приехал список.
  // Без отметки выбор остаётся за человеком: сами выгоду не выдумываем.
  useEffect(() => {
    if (selectedPeriod !== null) return;
    const requested = requestedPeriod
      ? options?.find((o) => o.period_days === requestedPeriod)
      : null;
    if (requested) {
      setSelectedPeriod(requested.period_days);
      return;
    }
    const best = pickBestValue(options);
    if (best) setSelectedPeriod(best.period_days);
  }, [options, selectedPeriod, requestedPeriod]);

  // Load balance
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options', subId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subId),
    staleTime: 0,
  });
  const balanceKopeks = purchaseOptions?.balance_kopeks ?? 0;

  const renewMutation = useMutation({
    retry: false,
    mutationFn: (periodDays: number) => subscriptionApi.renewSubscription(periodDays, subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-options', subId] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      navigate(`/subscriptions/${subId}`, { replace: true });
    },
    onError: (err: unknown) => {
      if (isUncertainPurchaseOutcome(err)) {
        setError(t('subscription.purchaseOutcomeUnknown'));
        return;
      }
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? null)
          : null;

      if (detail && typeof detail === 'object' && 'code' in (detail as Record<string, unknown>)) {
        const typed = detail as { code: string; missing_amount?: number };
        if (typed.code === 'insufficient_funds' && typed.missing_amount) {
          setError(`insufficient:${typed.missing_amount}`);
          return;
        }
      }
      setError(typeof detail === 'string' ? detail : t('common.error'));
    },
  });

  const handleRenew = (periodDays: number) => {
    impact('medium');
    setError(null);
    renewMutation.mutate(periodDays);
  };

  if (!subId) {
    return <Navigate to="/subscriptions" replace />;
  }

  // Старая подписка (куплена в классике, тарифа нет): продлевать нечего, бот
  // отдаёт пустой список — уводим на витрину тарифов с этой подпиской.
  if (needsTariff(subscription)) {
    return <Navigate to={tariffSelectionPath(subId)} replace />;
  }

  // Пробный период не продлевается: бот не отдаёт для него периодов, и страница
  // показывала тупик «Нет вариантов продления». Ведём на витрину тарифов.
  if (subscription?.is_trial) {
    return <Navigate to="/subscription/purchase" replace />;
  }

  if (isLoading || isSubscriptionLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-56" className="space-y-5">
        <Skeleton variant="card" className="h-16" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton variant="card" count={4} className="h-20" />
        </div>
      </PageSkeleton>
    );
  }

  const insufficientMatch = error?.match(/^insufficient:(\d+)$/);
  const missingAmount = insufficientMatch ? Number(insufficientMatch[1]) : null;

  // Целые суммы без «,00»: «299 ₽», а не «299,00 ₽».
  const money = (kopeks: number, options?: { round?: boolean }) =>
    formatMoney(kopeks / 100, options);
  const selectedOption = options?.find((o) => o.period_days === selectedPeriod) ?? null;
  const isDailyRenewal = Boolean(subscription?.is_daily && !subscription.is_trial);
  const isLifetime = Boolean(subscription && isLifetimeSubscription(subscription));

  return (
    <Page>
      <PageHeader
        title={t('subscription.extend', 'Продлить подписку')}
        subtitle={plainTariffName(subscription?.tariff_name) || undefined}
        backTo={`/subscriptions/${subId}`}
      />

      {/* Вечную подписку продлевать не нужно: «Продлить» на неё нигде не ведёт,
          но по прямой ссылке объясняем это вместо списка периодов. */}
      {isLifetime ? (
        <EmptyState
          icon={<PiInfinityDuotone />}
          title={t('lite.status.lifetime', 'Подписка работает навсегда')}
          text={t('subscription.v10.lifetimeNoRenew', 'Продлевать её не нужно.')}
          action={
            <Link
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-dark-800/70 px-5 text-[15px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/70"
              to={`/subscriptions/${subId}`}
            >
              {t('subscription.v10.toSubscription', 'К подписке')}
            </Link>
          }
        />
      ) : /* Daily subscriptions use daily billing, not period renewal. */
      isDailyRenewal && subscription ? (
        <Surface className="space-y-4">
          <p className="text-[13px] leading-snug text-dark-400">
            {t('subscription.dailyRenewalExplanation')}
          </p>
          <p className="text-[15px] font-semibold text-dark-50">
            {t('subscription.dailyRenewalPrice', {
              price: money(subscription.daily_price_kopeks ?? 0),
            })}
          </p>
          <DailyPausePanel subscription={subscription} subscriptionId={subId} />
          {canOpenTariffSwitch(subscription) && (
            <Link
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-dark-800/70 text-[15px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/70"
              to={tariffSelectionPath(subId)}
            >
              {t('subscription.switchTariff.title')}
            </Link>
          )}
        </Surface>
      ) : !options || options.length === 0 ? (
        <EmptyState
          icon={<PiCalendarXDuotone />}
          title={t('subscription.noRenewalOptions', 'Нет доступных вариантов продления')}
          text={t('subscription.noRenewalChooseTariff', 'Выберите тариф — доступ продолжится.')}
          action={
            <Link
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-cta-500 px-5 text-[15px] font-semibold text-on-cta transition-colors hover:bg-cta-600"
              to="/subscription/purchase"
            >
              {t('subscription.chooseTariff', 'Выбрать тариф')}
            </Link>
          }
        />
      ) : (
        <section>
          <SectionTitle>{t('subscription.selectPeriod', 'Выберите период')}</SectionTitle>
          <div className="space-y-2">
            {options.map((option) => {
              const isSelected = selectedPeriod === option.period_days;
              const perMonth = isLifetimePeriod(option.period_days)
                ? null
                : getMonthlyPriceKopeks(option.price_kopeks, option.period_days);
              // Выгодный вариант несёт жёлтую рамку и тогда, когда выбран: выбор
              // виден заливкой и внутренним кольцом, подсказка не пропадает.
              const isBestValue = Boolean(option.is_highlighted);

              return (
                <button
                  key={option.period_days}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    impact('light');
                    setSelectedPeriod(option.period_days);
                    setError(null);
                  }}
                  className={cn(
                    'flex min-h-[64px] w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition-colors',
                    isBestValue
                      ? `${bestValueFrame(isSelected)} ${isSelected ? 'bg-accent-500/15' : 'bg-dark-900/70'}`
                      : isSelected
                        ? 'bg-accent-500/15'
                        : 'bg-dark-900/70 hover:bg-dark-800/50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      isSelected ? 'bg-accent-500' : 'bg-dark-700',
                    )}
                    aria-hidden
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-dark-100">
                        {isLifetimePeriod(option.period_days)
                          ? t('subscription.lifetime.forever')
                          : `${option.period_days} ${t('subscription.days', 'дней')}`}
                      </span>
                      {isBestValue && <BestValueBadge />}
                      {option.discount_percent > 0 && (
                        <Chip tone="success">-{option.discount_percent}%</Chip>
                      )}
                    </span>
                    {perMonth !== null && (
                      <span className="mt-0.5 block text-[13px] text-dark-400">
                        {money(perMonth, { round: true })}/{t('subscription.month', 'мес')}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-dark-50">
                      {option.price_kopeks === 0
                        ? t('subscription.free', 'Бесплатно')
                        : money(option.price_kopeks)}
                    </span>
                    {option.original_price_kopeks && (
                      <span className="whitespace-nowrap text-[13px] text-dark-500 line-through">
                        {money(option.original_price_kopeks)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Итог: баланс, сумма, кнопка */}
      {!isDailyRenewal && !isLifetime && options && options.length > 0 && (
        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-[14px]">
            <span className="text-dark-400">{t('common.balance', 'Баланс')}</span>
            <span className="font-semibold tabular-nums text-dark-100">{money(balanceKopeks)}</span>
          </div>
          {selectedOption && (
            <div className="flex items-end justify-between gap-3 border-t border-dark-800/70 pt-4">
              <span className="text-[15px] font-medium text-dark-300">
                {t('subscription.total', 'К оплате')}
              </span>
              <span className="whitespace-nowrap text-[26px] font-bold leading-tight tracking-tight text-dark-50">
                {selectedOption.price_kopeks === 0
                  ? t('subscription.free', 'Бесплатно')
                  : money(selectedOption.price_kopeks)}
              </span>
            </div>
          )}
          {selectedOption && balanceKopeks < selectedOption.price_kopeks && !missingAmount && (
            <p className="text-[13px] text-error-400">
              {t(
                'subscription.insufficientBalanceAmount',
                'Недостаточно средств. Не хватает {{missing}}',
                { missing: money(selectedOption.price_kopeks - balanceKopeks) },
              )}
            </p>
          )}

          {/* Insufficient balance prompt */}
          {missingAmount && (
            <InsufficientBalancePrompt missingAmountKopeks={missingAmount} compact />
          )}

          {error && !missingAmount && (
            <p className="rounded-2xl bg-error-500/10 p-3 text-center text-[13px] text-error-400">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            onClick={() => selectedPeriod && handleRenew(selectedPeriod)}
            disabled={!selectedPeriod || renewMutation.isPending}
          >
            {renewMutation.isPending
              ? t('common.processing', 'Обработка...')
              : selectedPeriod
                ? t('subscription.extend', 'Продлить подписку')
                : t('subscription.selectPeriod', 'Выберите период')}
          </Button>
        </Surface>
      )}
    </Page>
  );
}
