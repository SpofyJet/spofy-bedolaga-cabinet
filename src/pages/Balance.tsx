import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { scrollToSection } from '@/utils/scrollToSection';
import { isLifetimePeriod, isLifetimeSubscription } from '@/utils/lifetime';
import { uiLocale } from '@/utils/uiLocale';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router';
import {
  PiArrowCounterClockwiseDuotone,
  PiArrowDownLeftDuotone,
  PiArrowUpRightDuotone,
  PiCaretRightBold,
  PiChartBarDuotone,
  PiCheckCircleDuotone,
  PiGiftDuotone,
  PiPlusBold,
  PiReceiptDuotone,
  PiShieldCheckDuotone,
  PiTicketBold,
  PiUsersThreeDuotone,
  PiWarningCircleDuotone,
  PiWarningDuotone,
} from 'react-icons/pi';

import { useAuthStore } from '../store/auth';
import { balanceApi } from '../api/balance';
import { subscriptionApi } from '../api/subscription';
import { referralApi } from '../api/referral';
import { useCurrency } from '../hooks/useCurrency';
import { API } from '../config/constants';
import type { PaginatedResponse, RenewalOption, Transaction } from '../types';

import { PageHeader } from '@/components/layout/PageHeader';
import {
  Button,
  EmptyState,
  Group,
  Page,
  Row,
  RowIcon,
  Stat,
  Surface,
  type Tone,
} from '@/components/spofy/ui';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { isPaidStatus, isFailedStatus } from '../utils/paymentStatus';
import { transactionTypeLabelKey } from '../utils/transactionType';
import { formatPeriodLabel } from '@/utils/periodLabel';
import { plainTariffName } from '@/utils/plainTariffName';

/** Иконка и цвет строки истории — по типу операции (типы бота, см. utils/transactionType). */
const TX_ICONS: Record<string, { icon: ReactNode; tone: Tone }> = {
  DEPOSIT: { icon: <PiArrowDownLeftDuotone />, tone: 'success' },
  WITHDRAWAL: { icon: <PiArrowUpRightDuotone />, tone: 'error' },
  SUBSCRIPTION_PAYMENT: { icon: <PiShieldCheckDuotone />, tone: 'plan' },
  REFUND: { icon: <PiArrowCounterClockwiseDuotone />, tone: 'success' },
  FAILED_REFUND: { icon: <PiWarningDuotone />, tone: 'error' },
  REFERRAL_REWARD: { icon: <PiUsersThreeDuotone />, tone: 'friends' },
  POLL_REWARD: { icon: <PiChartBarDuotone />, tone: 'promo' },
  GIFT_PAYMENT: { icon: <PiGiftDuotone />, tone: 'friends' },
};
const TX_FALLBACK = { icon: <PiReceiptDuotone />, tone: 'muted' as Tone };

/** «2 нояб., 14:30» — коротко, чтобы строка истории не обрезалась на телефоне. */
function txDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const time = date.toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** Какие периоды показать кнопками: 30 / 90 / 365 дней, если есть, иначе первые три. */
function pickShortcutPeriods(options: RenewalOption[]): RenewalOption[] {
  const sorted = [...options].sort((a, b) => a.period_days - b.period_days);
  const preferred = [30, 90, 365]
    .map((days) => sorted.find((o) => o.period_days === days))
    .filter((o): o is RenewalOption => !!o);
  return (preferred.length >= 2 ? preferred : sorted).slice(0, 3);
}

/** Цена в месяц и выгода к самому короткому периоду из показанных (от 5%). */
function perMonthInfo(option: RenewalOption, base: RenewalOption | undefined) {
  if (option.period_days < 60) return null;
  const perMonth = Math.round((option.price_rubles * 30) / option.period_days);
  const baseMonth = base ? (base.price_rubles * 30) / base.period_days : 0;
  const saving = baseMonth > 0 ? Math.round(100 - (perMonth * 100) / baseMonth) : 0;
  return { perMonth, saving: saving >= 5 ? saving : 0 };
}

function Spin() {
  return (
    <span
      aria-hidden
      className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/**
 * Баланс: сумма и два действия (пополнить, промокод), продление в один шаг,
 * сохранённые карты, история операций. Способы оплаты — на /balance/top-up,
 * куда ведёт «Пополнить» (туда же ведёт быстрое действие на главной).
 */
export default function Balance() {
  const { t } = useTranslation();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const queryClient = useQueryClient();
  const { formatAmount, formatMoney, currencySymbol } = useCurrency();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentHandledRef = useRef(false);

  // Fetch balance from API
  const { data: balanceData, refetch: refetchBalance } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
    refetchOnMount: 'always',
  });

  // Продление «в один шаг»: ближайшие периоды с ценами прямо под балансом
  const { data: subscriptionResponse } = useQuery({
    queryKey: ['subscription', undefined],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: 30_000,
  });
  const ownSubscription = subscriptionResponse?.subscription ?? null;
  // Вечную подписку (ULTIMA) не продлевают — блока «Продлить подписку» у неё нет.
  const canRenew =
    !!ownSubscription &&
    !ownSubscription.is_trial &&
    !ownSubscription.is_daily &&
    !isLifetimeSubscription(ownSubscription);
  const { data: renewalOptions } = useQuery({
    queryKey: ['renewal-options', ownSubscription?.id],
    queryFn: () => subscriptionApi.getRenewalOptions(ownSubscription?.id),
    enabled: canRenew,
    retry: false,
    staleTime: 60_000,
  });
  const shortcuts =
    canRenew && Array.isArray(renewalOptions) ? pickShortcutPeriods(renewalOptions) : [];

  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const referralEarnings = referralInfo?.total_earnings_rubles ?? 0;

  // Refresh user data on mount to sync balance in store
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Handle payment return from payment gateway
  useEffect(() => {
    if (paymentHandledRef.current) return;

    const paymentStatus = searchParams.get('payment') || searchParams.get('status');

    const normalised = paymentStatus?.toLowerCase() ?? '';
    const isSuccess = isPaidStatus(normalised) || searchParams.get('success') === 'true';
    const isFailed = isFailedStatus(normalised);

    if (isSuccess) {
      paymentHandledRef.current = true;
      navigate('/balance/top-up/result?status=success', { replace: true });
    } else if (isFailed) {
      paymentHandledRef.current = true;
      navigate('/balance/top-up/result?status=failed', { replace: true });
    }
  }, [searchParams, navigate]);

  const [promocode, setPromocode] = useState('');
  const [promocodeLoading, setPromocodeLoading] = useState(false);
  const [promocodeError, setPromocodeError] = useState<string | null>(null);
  const [promocodeSuccess, setPromocodeSuccess] = useState<{
    message: string;
    amount: number;
  } | null>(null);
  const [promoSelectSubs, setPromoSelectSubs] = useState<Array<{
    id: number;
    tariff_name: string;
    days_left: number;
  }> | null>(null);
  const [promoSelectCode, setPromoSelectCode] = useState<string | null>(null);
  // ?section=promo | ?section=history — ссылки «Промокод» и «История платежей»
  // с главной и из профиля: нужный блок сразу раскрыт и подкручен в экран.
  const deepSection = searchParams.get('section');
  const { topSafeArea } = useHeaderHeight();
  const [promoOpen, setPromoOpen] = useState(deepSection === 'promo');
  const promoRef = useRef<HTMLDivElement>(null);
  const promoInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [transactionsPage, setTransactionsPage] = useState(1);
  useEffect(() => {
    const target =
      deepSection === 'promo'
        ? promoRef.current
        : deepSection === 'history'
          ? historyRef.current
          : null;
    if (!target) return;
    const timer = setTimeout(
      () => scrollToSection(target, topSafeArea, { onlyIfHidden: deepSection === 'promo' }),
      350,
    );
    return () => clearTimeout(timer);
  }, [deepSection, topSafeArea]);

  const { data: transactions, isLoading } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['transactions', transactionsPage],
    queryFn: () => balanceApi.getTransactions({ per_page: 20, page: transactionsPage }),
    placeholderData: (previousData) => previousData,
  });

  const handlePromocodeActivate = async (subscriptionId?: number) => {
    const code = subscriptionId ? promoSelectCode || '' : promocode.trim();
    if (!code) return;

    setPromocodeLoading(true);
    setPromocodeError(null);
    setPromocodeSuccess(null);

    try {
      const result = await balanceApi.activatePromocode(code, subscriptionId);

      if (result.error === 'select_subscription' && result.eligible_subscriptions) {
        setPromoSelectSubs(result.eligible_subscriptions);
        setPromoSelectCode(result.code || code);
        return;
      }

      if (result.success) {
        const bonusAmount = (result.balance_after || 0) - (result.balance_before || 0);
        setPromocodeSuccess({
          message: result.bonus_description || t('balance.promocode.success'),
          amount: bonusAmount,
        });
        setTransactionsPage(1);
        setPromocode('');
        setPromoSelectSubs(null);
        setPromoSelectCode(null);
        await refetchBalance();
        await refreshUser();
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
        queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      }
    } catch (error: unknown) {
      // Backend returns a structured error: detail = { code, message }. We map
      // the stable machine code to a localized string. (The old contract
      // substring-matched English prose and silently degraded every unmapped
      // code — active_discount_exists, daily_limit, … — to "server error".)
      const axiosError = error as {
        response?: { data?: { detail?: { code?: string } | string } };
      };
      const detail = axiosError.response?.data?.detail;
      const code = typeof detail === 'object' && detail ? detail.code : undefined;
      const knownErrorKeys = [
        'not_found',
        'expired',
        'inactive',
        'not_yet_valid',
        'used',
        'already_used_by_user',
        'active_discount_exists',
        'no_subscription_for_days',
        'subscription_not_found',
        'not_first_purchase',
        'paid_subscription_required',
        'daily_limit',
        'trial_subscription_exists',
        'trial_provisioning_failed',
        'user_not_found',
        'server_error',
      ];
      const errorKey = code && knownErrorKeys.includes(code) ? code : 'server_error';
      setPromocodeError(t(`balance.promocode.errors.${errorKey}`));
      setPromoSelectSubs(null);
      setPromoSelectCode(null);
    } finally {
      setPromocodeLoading(false);
    }
  };

  const balanceRubles = balanceData?.balance_rubles || 0;
  const promoVisible =
    promoOpen || !!promocode || !!promocodeError || !!promocodeSuccess || !!promoSelectSubs;

  const openPromo = () => {
    setPromoOpen(true);
    setTimeout(() => {
      promoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      promoInputRef.current?.focus({ preventScroll: true });
    }, 60);
  };

  return (
    <Page>
      <PageHeader title={t('balance.title')} backTo="/" />

      <Surface>
        <Stat
          label={t('balance.currentBalance')}
          value={
            balanceData === undefined ? (
              <Skeleton className="h-[30px] w-28" />
            ) : (
              formatMoney(balanceRubles)
            )
          }
          hint={
            referralEarnings > 0 && balanceRubles > 0
              ? t('balance.referralEarned', {
                  amount: formatAmount(referralEarnings, 0),
                  currency: currencySymbol,
                })
              : undefined
          }
        />
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Button onClick={() => navigate('/balance/top-up')}>
            <PiPlusBold className="h-4 w-4" aria-hidden />
            {t('balance.topUp')}
          </Button>
          <Button tone="secondary" onClick={openPromo} aria-expanded={promoVisible}>
            <PiTicketBold className="h-4 w-4" aria-hidden />
            {t('balance.promocode.title')}
          </Button>
        </div>
      </Surface>

      {/* Промокод: открывается кнопкой выше или ссылкой ?section=promo */}
      {promoVisible && (
        <div ref={promoRef} className="scroll-mt-6">
          <Surface>
            <label htmlFor="balance-promocode" className="sr-only">
              {t('balance.promocode.title')}
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                ref={promoInputRef}
                id="balance-promocode"
                type="text"
                value={promocode}
                onChange={(e) => setPromocode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePromocodeActivate()}
                placeholder={t('balance.promocode.placeholder')}
                autoComplete="off"
                autoCapitalize="characters"
                className="h-12 w-full min-w-0 rounded-2xl sm:flex-1 bg-dark-800/60 px-4 text-[15px] font-semibold text-dark-50 transition-shadow placeholder:font-normal placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-500/60 disabled:opacity-60"
                disabled={promocodeLoading}
              />
              <Button
                onClick={() => handlePromocodeActivate()}
                disabled={!promocode.trim() || promocodeLoading}
                aria-busy={promocodeLoading}
              >
                {promocodeLoading && <Spin />}
                {t('balance.promocode.activate')}
              </Button>
            </div>

            {promocodeError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 px-1 text-[13px] leading-snug text-error-400"
              >
                <PiWarningCircleDuotone className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
                {promocodeError}
              </p>
            )}
            {promocodeSuccess && (
              <div
                role="status"
                className="mt-3 flex items-start gap-3 rounded-2xl bg-success-500/10 p-3"
              >
                <PiCheckCircleDuotone
                  className="h-[22px] w-[22px] shrink-0 text-success-400"
                  aria-hidden
                />
                <div className="min-w-0 text-[13px] leading-snug">
                  <p className="font-semibold text-dark-100">{promocodeSuccess.message}</p>
                  {promocodeSuccess.amount > 0 && (
                    <p className="mt-0.5 text-dark-400">
                      {t('balance.promocode.balanceAdded', {
                        amount: formatAmount(promocodeSuccess.amount),
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {promoSelectSubs && promoSelectSubs.length > 0 && (
              <div className="mt-4">
                <p className="px-1 text-[13px] font-semibold text-dark-400">
                  {t(
                    'balance.promocode.selectSubscription',
                    'К какой подписке применить промокод?',
                  )}
                </p>
                <div className="mt-2 divide-y divide-dark-800/70 overflow-hidden rounded-2xl">
                  {promoSelectSubs.map((sub) => (
                    <Row
                      key={sub.id}
                      icon={<PiShieldCheckDuotone />}
                      iconTone="plan"
                      label={plainTariffName(sub.tariff_name)}
                      hint={
                        isLifetimePeriod(sub.days_left)
                          ? t('subscription.lifetime.forever')
                          : t('balance.promocode.daysLeft', '{{count}} дн.', {
                              count: sub.days_left,
                            })
                      }
                      onClick={() => handlePromocodeActivate(sub.id)}
                      disabled={promocodeLoading}
                    />
                  ))}
                </div>
                <Button
                  tone="ghost"
                  className="mt-2 h-10 px-3 text-[13px]"
                  onClick={() => {
                    setPromoSelectSubs(null);
                    setPromoSelectCode(null);
                  }}
                >
                  {t('common.cancel', 'Отмена')}
                </Button>
              </div>
            )}
          </Surface>
        </div>
      )}

      {/* Продление: периоды с ценой, один тап до страницы продления с уже выбранным сроком */}
      {ownSubscription && shortcuts.length > 0 && (
        <Group
          title={t('balance.renew.title')}
          right={
            <span className="text-[13px] text-dark-500">
              {t('balance.renew.untilShort', 'до {{date}}', {
                date: new Date(ownSubscription.end_date).toLocaleDateString(uiLocale(), {
                  day: 'numeric',
                  month: 'long',
                }),
              })}
            </span>
          }
        >
          {shortcuts.map((option) => {
            const info = perMonthInfo(option, shortcuts[0]);
            const note = info
              ? t('balance.renew.perMonth', {
                  amount: formatAmount(info.perMonth, 0),
                  currency: currencySymbol,
                }) + (info.saving ? ` · −${info.saving}%` : '')
              : option.discount_percent > 0
                ? `−${option.discount_percent}%`
                : undefined;
            return (
              <Row
                key={option.period_days}
                label={formatPeriodLabel(option.period_days, t)}
                description={note}
                onClick={() =>
                  navigate(
                    `/subscriptions/${ownSubscription.id}/renew?period=${option.period_days}`,
                  )
                }
                trailing={
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap text-[15px] font-bold text-dark-50">
                      {formatMoney(option.price_rubles)}
                    </span>
                    <PiCaretRightBold className="h-3.5 w-3.5 text-dark-500" aria-hidden />
                  </span>
                }
              />
            );
          })}
        </Group>
      )}

      {/* История операций */}
      <div ref={historyRef} className="scroll-mt-6">
        {isLoading ? (
          <Group title={t('balance.transactionHistory')}>
            <SkeletonGroup className="space-y-2 p-4">
              <Skeleton variant="card" count={3} className="h-12" />
            </SkeletonGroup>
          </Group>
        ) : transactions?.items && transactions.items.length > 0 ? (
          <Group title={t('balance.transactionHistory')}>
            {transactions.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </Group>
        ) : (
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
              {t('balance.transactionHistory')}
            </h2>
            <EmptyState
              icon={<PiReceiptDuotone />}
              title={t('balance.noTransactions')}
              text={t('balance.noTransactionsHint', 'Здесь появятся пополнения и оплаты')}
            />
          </section>
        )}

        {transactions && transactions.pages > 1 && (
          // Три колонки: «Далее» не уезжает отдельной строкой на всю ширину.
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[13px] text-dark-400">
            <Button
              tone="secondary"
              className="h-10 text-[13px]"
              onClick={() => setTransactionsPage((prev) => Math.max(1, prev - 1))}
              disabled={transactions.page <= 1}
            >
              {t('common.back')}
            </Button>
            <div className="whitespace-nowrap text-center">
              {t('balance.page', {
                current: transactions.page,
                total: transactions.pages,
              })}
            </div>
            <Button
              tone="secondary"
              className="h-10 text-[13px]"
              onClick={() =>
                setTransactionsPage((prev) =>
                  transactions.pages ? Math.min(transactions.pages, prev + 1) : prev + 1,
                )
              }
              disabled={transactions.page >= transactions.pages}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </div>
    </Page>
  );
}

/** Строка истории: иконка типа, описание, тип и дата, сумма зелёная/красная. */
function TransactionRow({ tx }: { tx: Transaction }) {
  const { t } = useTranslation();
  const { formatMoney } = useCurrency();
  const { icon, tone } = TX_ICONS[tx.type?.toUpperCase?.() ?? ''] ?? TX_FALLBACK;
  const typeLabel = t(transactionTypeLabelKey(tx.type));
  const isZero = tx.amount_rubles === 0;
  const isPositive = tx.amount_rubles > 0;
  const sign = isZero ? '' : isPositive ? '+' : '−';
  const colorClass = isZero ? 'text-dark-400' : isPositive ? 'text-success-400' : 'text-dark-100';
  const date = txDate(tx.created_at);
  const amount = Math.abs(tx.amount_rubles);
  // «Пополнение · Пополнение» не повторяем: тип — только если описание о другом.
  const showType = !!tx.description && tx.description.trim() !== typeLabel;

  return (
    <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
      <RowIcon tone={tone}>{icon}</RowIcon>
      <span className="min-w-0 flex-1">
        {/* Почта, ник, номер счёта — без пробелов, переносятся где угодно. */}
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-dark-100 [overflow-wrap:anywhere]">
          {tx.description || typeLabel}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-dark-400">
          {showType ? `${typeLabel} · ${date}` : date}
        </span>
      </span>
      <span className={`shrink-0 whitespace-nowrap text-[15px] font-bold ${colorClass}`}>
        {sign}
        {formatMoney(amount)}
      </span>
    </div>
  );
}
