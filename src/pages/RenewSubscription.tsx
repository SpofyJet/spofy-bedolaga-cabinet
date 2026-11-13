import { isLifetimePeriod, isLifetimeSubscription } from '@/utils/lifetime';
import { isUncertainPurchaseOutcome } from '@/utils/api-error';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { getMonthlyPriceKopeks } from '../utils/pricing';
import { pickBestValue } from '../utils/bestValue';
import { formatPeriodLabel } from '../utils/periodLabel';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '../platform';
import { useSuccessNotification } from '../store/successNotification';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { PeriodList } from '../components/subscription/PeriodList';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Chip, EmptyState, Page, SectionTitle, Surface } from '@/components/spofy/ui';
import { PiCalendarXDuotone, PiInfinityDuotone } from 'react-icons/pi';
import { PageSkeleton, Skeleton } from '../components/ui/skeleton';
import { DailyPausePanel } from '../components/subscription/manage/DailyPausePanel';
import { canOpenTariffSwitch, needsTariff, tariffSelectionPath } from '../utils/legacySubscription';
import { plainTariffName } from '@/utils/plainTariffName';
import { formatLiteDate } from '@/utils/liteDate';

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
  useEffect(() => {
    if (selectedPeriod !== null) return;
    const requested = requestedPeriod
      ? options?.find((o) => o.period_days === requestedPeriod)
      : null;
    if (requested) {
      setSelectedPeriod(requested.period_days);
      return;
    }
    // Без отметки оператора — 3 месяца, если такой срок есть, иначе первый:
    // кнопка оплаты не должна ждать лишнего нажатия.
    const preselected =
      pickBestValue(options) ?? options?.find((o) => o.period_days === 90) ?? options?.[0];
    if (preselected) setSelectedPeriod(preselected.period_days);
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-options', subId] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      navigate(`/subscriptions/${subId}`, { replace: true });
      // Подтверждение оплаты. Раньше экран подписки открывался молча, с кнопкой
      // «Продлить подписку» на виду — и часть людей шла продлевать ещё раз.
      useSuccessNotification.getState().show({
        type: 'subscription_renewed',
        amountKopeks: data?.amount_paid_kopeks,
        expiresAt: data?.new_end_date,
        onSubscriptionScreen: true,
      });
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
  // «Выгодно» — на отмеченном ботом сроке, иначе на 3 месяцах (решение владельца
  // 23.10, как на странице подписки); 3 месяца подставляем, только когда есть из чего выбирать.
  const recommendedDays = (
    pickBestValue(options) ??
    (options && options.length > 1 ? options.find((o) => o.period_days === 90) : undefined)
  )?.period_days;
  // Выгода против помесячной оплаты, целыми рублями вниз — не обещаем больше, чем есть.
  const monthly = options?.find((o) => o.period_days === 30);
  const savingKopeks = (o: { period_days: number; price_kopeks: number }) =>
    monthly && o.period_days > 31 && !isLifetimePeriod(o.period_days)
      ? Math.floor(
          Math.max(0, monthly.price_kopeks * Math.round(o.period_days / 30) - o.price_kopeks) / 100,
        ) * 100
      : 0;
  // Баланса не хватает: кнопка сразу ведёт на пополнение недостающей суммы и
  // возвращает на этот же срок (раньше — красная ошибка до нажатия и лишний шаг).
  const shortKopeks =
    selectedOption && selectedOption.price_kopeks > 0
      ? Math.max(0, selectedOption.price_kopeks - balanceKopeks)
      : 0;
  const shortRubles = Math.ceil(shortKopeks / 100);
  const goTopUp = () => {
    if (!selectedOption) return;
    impact('medium');
    const params = new URLSearchParams();
    params.set('amount', String(shortRubles));
    params.set('returnTo', `/subscriptions/${subId}/renew?period=${selectedOption.period_days}`);
    navigate(`/balance/top-up?${params.toString()}`);
  };
  const isDailyRenewal = Boolean(subscription?.is_daily && !subscription.is_trial);
  const isLifetime = Boolean(subscription && isLifetimeSubscription(subscription));
  const showPay = !isDailyRenewal && !isLifetime && Boolean(options && options.length > 0);

  // До какого числа будет работать VPN: бот прибавляет срок к концу оплаченного
  // периода, а у закончившейся подписки — к сегодняшнему дню.
  const worksUntil = (() => {
    if (!selectedOption || isLifetimePeriod(selectedOption.period_days)) return null;
    const end = subscription?.end_date ? new Date(subscription.end_date).getTime() : Number.NaN;
    const from = Number.isNaN(end) ? Date.now() : Math.max(end, Date.now());
    return formatLiteDate(new Date(from + selectedOption.period_days * 86_400_000).toISOString());
  })();
  // Если на балансе есть деньги, говорим, сколько из них уйдёт: на кнопке — только доплата.
  const price = selectedOption?.price_kopeks ?? 0;
  const balanceNote =
    !selectedOption || price === 0 || balanceKopeks < 100
      ? null
      : shortKopeks > 0
        ? t('subscription.v10.fromBalancePart', '{{amount}} спишется с баланса', {
            amount: money(price - shortRubles * 100, { round: true }),
          })
        : t('subscription.v10.fromBalanceFull', 'Спишется с баланса — на нём {{amount}}', {
            amount: money(balanceKopeks),
          });
  const payLabel = renewMutation.isPending
    ? t('common.processing', 'Обработка...')
    : !selectedOption
      ? t('subscription.selectPeriod', 'Выберите период')
      : price === 0
        ? t('subscription.extend', 'Продлить подписку')
        : shortKopeks > 0
          ? t('subscription.v10.payShort', 'Оплатить {{amount}}', {
              amount: money(shortRubles * 100, { round: true }),
            })
          : t('subscription.v10.renewFor', 'Продлить за {{amount}}', {
              amount: money(price),
            });

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
          <PeriodList
            selectedDays={selectedPeriod}
            onSelect={(days) => {
              impact('light');
              setSelectedPeriod(days);
              setError(null);
            }}
            items={options.map((option) => {
              // За месяц и короче «в месяц» повторяло бы саму цену.
              const perMonth =
                isLifetimePeriod(option.period_days) || option.period_days <= 31
                  ? null
                  : getMonthlyPriceKopeks(option.price_kopeks, option.period_days);
              const saving = savingKopeks(option);
              return {
                days: option.period_days,
                label: formatPeriodLabel(option.period_days, t),
                best: option.period_days === recommendedDays,
                discount:
                  option.discount_percent > 0 ? (
                    <Chip tone="success">-{option.discount_percent}%</Chip>
                  ) : null,
                perMonth: perMonth !== null ? money(perMonth, { round: true }) : null,
                saving: saving > 0 ? money(saving, { round: true }) : null,
                price:
                  option.price_kopeks === 0
                    ? t('subscription.free', 'Бесплатно')
                    : money(option.price_kopeks),
                original: option.original_price_kopeks ? money(option.original_price_kopeks) : null,
              };
            })}
          />
        </section>
      )}

      {/* Ошибки оплаты — под списком, над прижатой кнопкой */}
      {showPay && missingAmount && (
        <Surface>
          <InsufficientBalancePrompt missingAmountKopeks={missingAmount} compact />
        </Surface>
      )}
      {showPay && error && !missingAmount && (
        <p className="rounded-2xl bg-error-500/10 p-3 text-center text-[13px] text-error-400">
          {error}
        </p>
      )}

      {/* Кнопка оплаты прижата к низу экрана: выбор срока и оплата видны вместе,
          без прокрутки. Над ней — до какого числа будет работать VPN и, если на
          балансе есть деньги, сколько из них уйдёт. На широком экране — в потоке. */}
      {showPay && (
        <>
          <div className="h-[124px] lg:hidden" aria-hidden />
          <div
            data-pay-bar
            className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-dark-950 from-70% to-transparent px-4 pb-[calc(var(--mobile-nav-clearance)+2px)] pt-5 lg:static lg:z-auto lg:bg-none lg:p-0"
          >
            <div className="mx-auto w-full max-w-[600px]">
              {selectedOption && (
                <div className="pb-2.5 text-center text-sm text-dark-400">
                  {worksUntil && (
                    <p>
                      {t('subscription.v10.worksLabel', 'VPN будет работать')}{' '}
                      <span className="font-semibold text-dark-50">
                        {t('subscription.v10.until', 'до {{date}}', { date: worksUntil })}
                      </span>
                    </p>
                  )}
                  {balanceNote && <p className="mt-0.5">{balanceNote}</p>}
                </div>
              )}
              <Button
                className="h-[54px] w-full text-[16.5px]"
                onClick={() =>
                  shortKopeks > 0 ? goTopUp() : selectedPeriod && handleRenew(selectedPeriod)
                }
                disabled={!selectedPeriod || renewMutation.isPending}
              >
                {payLabel}
              </Button>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
