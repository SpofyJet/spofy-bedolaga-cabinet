import { isLifetimePeriod } from '@/utils/lifetime';
import { formatSmartDate } from '@/utils/liteDate';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { giftApi } from '../api/gift';
import {
  canUseTelegramScanner,
  loadHtml5Qrcode,
  parseGiftCode,
  scanWithTelegram,
  type Html5QrcodeInstance,
} from '@/utils/qrScanner';
import { brandingApi, type TelegramWidgetConfig } from '../api/branding';
import type {
  GiftConfig,
  GiftTariff,
  GiftTariffPeriod,
  GiftPaymentMethod,
  GiftPurchaseRequest,
  SentGift,
  ReceivedGift,
} from '../api/gift';

import { cn } from '../lib/utils';
import { copyToClipboard } from '../utils/clipboard';
import { buildGiftClaimArtifacts } from '../utils/giftShare';
import { getApiErrorMessage } from '../utils/api-error';
import { formatPriceShort as formatPrice } from '../utils/format';
import { pickBestValue } from '../utils/bestValue';
import { BestValueBadge, bestValueFrame } from '../components/subscription/BestValueBadge';
import { useCurrency } from '../hooks/useCurrency';
import { usePlatform, useHaptic } from '@/platform';
import { openPaymentUrl } from '../utils/openPaymentUrl';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Chip, EmptyState, Page, RowIcon } from '@/components/spofy/ui';
import {
  SparklesIcon,
  GiftIcon,
  CheckIcon,
  CheckCircleIcon,
  KeyIcon,
  InboxIcon,
  ExportIcon,
  WarningCircleIcon,
  BanIcon,
} from '@/components/icons';
import { formatPeriodLabel } from '@/utils/periodLabel';
import { plainTariffName } from '@/utils/plainTariffName';

function getGiftStatusKey(status: string): string {
  const statusMap: Record<string, string> = {
    pending_activation: 'gift.statusPendingActivation',
    delivered: 'gift.statusDelivered',
    paid: 'gift.statusAvailable',
    pending: 'gift.statusPending',
    failed: 'gift.statusFailed',
    expired: 'gift.statusExpired',
  };
  return statusMap[status] ?? 'gift.statusPending';
}

function isGiftAvailable(status: string): boolean {
  return status === 'paid' || status === 'delivered' || status === 'pending_activation';
}

function isGiftActivated(gift: SentGift): boolean {
  return gift.status === 'delivered' && gift.activated_by_username != null;
}

function formatGiftDate(dateStr: string | null): string {
  return formatSmartDate(dateStr, '2-digit');
}

type TabId = 'buy' | 'activate' | 'myGifts';

function LoadingSkeleton() {
  return (
    <Page>
      <SkeletonGroup className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton variant="card" count={3} className="h-20 rounded-3xl" />
      </SkeletonGroup>
    </Page>
  );
}

function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation();

  return (
    <Page>
      <PageHeader title={t('gift.pageTitle')} backTo="/profile" />
      <EmptyState icon={<WarningCircleIcon />} title={t('gift.failedTitle')} text={message} />
    </Page>
  );
}

function DisabledState() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <Page>
      <PageHeader title={t('gift.pageTitle')} backTo="/profile" />
      <EmptyState
        icon={<BanIcon />}
        title={t('gift.featureDisabled')}
        text={t('gift.redirecting')}
      />
    </Page>
  );
}

function TariffCard({
  tariff,
  isSelected,
  onSelect,
}: {
  tariff: GiftTariff;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        'block w-full rounded-3xl p-4 text-start transition-colors duration-200',
        tariff.is_highlighted
          ? cn(bestValueFrame(isSelected), isSelected ? 'bg-accent-500/15' : 'bg-dark-900/70')
          : isSelected
            ? 'bg-accent-500/15'
            : 'bg-dark-900/70 hover:bg-dark-800/50',
      )}
    >
      {/* Отметка оператора первой строкой, как в покупке и продлении: этот тариф
          выбран сразу — подпись объясняет почему. */}
      {tariff.is_highlighted && <BestValueBadge className="mb-3" />}
      <div className="flex items-center gap-3">
        <RowIcon tone={isSelected ? 'accent' : 'muted'}>
          <GiftIcon />
        </RowIcon>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-dark-50">
            {plainTariffName(tariff.name)}
          </p>
          <p
            className={cn(
              'mt-0.5 text-[13px] transition-colors',
              isSelected ? 'text-accent-400' : 'text-dark-400',
            )}
          >
            {tariff.traffic_limit_gb > 0
              ? `${tariff.traffic_limit_gb} ${t('gift.gbShort')}`
              : t('gift.unlimitedTraffic')}
            {' \u2022 '}
            {t('gift.deviceCount', { count: tariff.device_limit })}
          </p>
        </div>

        {/* Checkmark circle */}
        <div
          className={cn(
            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors',
            isSelected ? 'bg-accent-500' : 'bg-dark-700',
          )}
        >
          {isSelected && <CheckIcon className="h-3 w-3 text-on-accent" />}
        </div>
      </div>
    </button>
  );
}

function PeriodCard({
  period,
  isSelected,
  onSelect,
}: {
  period: GiftTariffPeriod;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const hasDiscount =
    period.original_price_kopeks != null && period.original_price_kopeks > period.price_kopeks;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      // Выбор — подсветкой и голубой рамкой, как в покупке и продлении. Сплошная
      // голубая заливка выбранного съедала золотую плашку «Выгодно».
      className={cn(
        'block w-full rounded-3xl p-4 text-start transition-colors duration-200',
        period.is_highlighted
          ? cn(bestValueFrame(isSelected), isSelected ? 'bg-accent-500/15' : 'bg-dark-900/70')
          : isSelected
            ? 'bg-accent-500/15'
            : 'bg-dark-900/70 hover:bg-dark-800/50',
      )}
    >
      {/* Отметка оператора первой строкой: этот период выбран сразу — подпись
          объясняет почему. */}
      {period.is_highlighted && <BestValueBadge className="mb-2" />}
      <div className="flex items-center justify-between gap-3">
        {/* Left: period + discount */}
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-[15px] font-semibold text-dark-50">
            {formatPeriodLabel(period.days, t)}
          </span>
          {hasDiscount && period.discount_percent != null && (
            <Chip tone="success">-{period.discount_percent}%</Chip>
          )}
        </div>

        {/* Right: prices */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="whitespace-nowrap text-[17px] font-bold text-dark-50">
            {formatPrice(period.price_kopeks)}
          </span>
          {hasDiscount && period.original_price_kopeks != null && (
            <span className="whitespace-nowrap text-xs text-dark-500 line-through">
              {formatPrice(period.original_price_kopeks)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function PaymentModeToggle({
  mode,
  onToggle,
  balanceLabel,
}: {
  mode: 'balance' | 'gateway';
  onToggle: (mode: 'balance' | 'gateway') => void;
  balanceLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('gift.paymentMode')}
      className="flex rounded-2xl bg-dark-900/70 p-1"
    >
      <button
        type="button"
        onClick={() => onToggle('balance')}
        aria-pressed={mode === 'balance'}
        className={cn(
          'flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200',
          mode === 'balance' ? 'bg-dark-800 text-dark-50' : 'text-dark-400 hover:text-dark-200',
        )}
      >
        {balanceLabel}
      </button>
      <button
        type="button"
        onClick={() => onToggle('gateway')}
        aria-pressed={mode === 'gateway'}
        className={cn(
          'flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200',
          mode === 'gateway' ? 'bg-dark-800 text-dark-50' : 'text-dark-400 hover:text-dark-200',
        )}
      >
        {t('gift.viaGateway')}
      </button>
    </div>
  );
}

function PaymentMethodCard({
  method,
  isSelected,
  selectedSubOption,
  onSelect,
  onSelectSubOption,
}: {
  method: GiftPaymentMethod;
  isSelected: boolean;
  selectedSubOption: string | null;
  onSelect: () => void;
  onSelectSubOption: (subOptionId: string) => void;
}) {
  const hasSubOptions = method.sub_options && method.sub_options.length > 1;

  return (
    <div
      className={cn(
        'rounded-3xl transition-colors duration-200',
        isSelected ? 'bg-accent-500/15' : 'bg-dark-900/70 hover:bg-dark-800/50',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={onSelect}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start"
      >
        {method.icon_url && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-dark-800/50">
            <img src={method.icon_url} alt="" className="h-6 w-6 object-contain" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-dark-100">{method.display_name}</p>
          {method.description && (
            <p className="mt-0.5 truncate text-xs text-dark-400">{method.description}</p>
          )}
        </div>
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
            isSelected ? 'bg-accent-500' : 'bg-dark-700',
          )}
        >
          {isSelected && <div className="h-2 w-2 rounded-full bg-on-accent" />}
        </div>
      </button>

      {isSelected && hasSubOptions && (
        <div className="border-t border-dark-800/30 px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {method.sub_options?.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectSubOption(opt.id)}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                  selectedSubOption === opt.id
                    ? 'bg-accent-500 text-on-accent'
                    : 'bg-dark-800/50 text-dark-300 hover:bg-dark-700/50',
                )}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BuyTabContent({
  config,
  onPurchaseComplete,
}: {
  config: GiftConfig;
  onPurchaseComplete: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openInvoice, capabilities, openLink, platform } = usePlatform();
  const haptic = useHaptic();

  // Selection state
  const [selectedTariffId, setSelectedTariffId] = useState<number | null>(null);
  const [selectedPeriodDays, setSelectedPeriodDays] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<'balance' | 'gateway'>('balance');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedSubOption, setSelectedSubOption] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Тариф и период выбираются ОДНИМ эффектом: отмеченные оператором выгодными,
  // иначе первые по счёту. Двумя эффектами это разъезжалось — второй записывал
  // «прошлый тариф» уже после того, как первый выбрал период, и затирал выбор,
  // сделанный человеком между этими двумя проходами.
  const lastTariffIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (config.tariffs.length === 0) return;
    const tariff = selectedTariffId
      ? config.tariffs.find((t) => t.id === selectedTariffId)
      : (pickBestValue(config.tariffs) ?? config.tariffs[0]);
    if (!tariff) return;
    if (selectedTariffId !== tariff.id) setSelectedTariffId(tariff.id);
    // Период пересчитываем только при смене тарифа: внутри одного тарифа выбор
    // человека важнее отметки оператора.
    if (lastTariffIdRef.current === tariff.id) return;
    lastTariffIdRef.current = tariff.id;
    if (tariff.periods.length > 0) {
      const period = pickBestValue(tariff.periods) ?? tariff.periods[0];
      setSelectedPeriodDays(period.days);
    }
  }, [config.tariffs, selectedTariffId]);

  // Способ оплаты по умолчанию — первый из доступных.
  useEffect(() => {
    if (config.payment_methods.length > 0 && selectedMethod === null) {
      const firstMethod = config.payment_methods[0];
      setSelectedMethod(firstMethod.method_id);
      if (firstMethod.sub_options && firstMethod.sub_options.length >= 1) {
        setSelectedSubOption(firstMethod.sub_options[0].id);
      } else {
        setSelectedSubOption(null);
      }
    }
  }, [config.payment_methods, selectedMethod]);

  // Derived data
  const selectedTariff = useMemo(
    () => config.tariffs.find((tr) => tr.id === selectedTariffId),
    [config.tariffs, selectedTariffId],
  );

  const selectedPeriod = useMemo(
    () => selectedTariff?.periods.find((p) => p.days === selectedPeriodDays),
    [selectedTariff, selectedPeriodDays],
  );

  const currentPrice = selectedPeriod?.price_kopeks ?? 0;

  const insufficientBalance = paymentMode === 'balance' && config.balance_kopeks < currentPrice;

  // Validation
  const canSubmit = useMemo(() => {
    if (!selectedTariffId || !selectedPeriodDays) return false;
    if (paymentMode === 'gateway' && !selectedMethod) return false;
    if (insufficientBalance) return false;
    return true;
  }, [selectedTariffId, selectedPeriodDays, paymentMode, selectedMethod, insufficientBalance]);

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: (data: GiftPurchaseRequest) => giftApi.createPurchase(data),
    onSuccess: async (result) => {
      if (result.payment_url) {
        // Telegram Stars: open invoice natively instead of redirect
        const isStars = selectedMethod === 'telegram_stars';
        if (isStars && capabilities.hasInvoice) {
          try {
            const status = await openInvoice(result.payment_url);
            if (status === 'paid') {
              haptic.notification('success');
              queryClient.invalidateQueries({ queryKey: ['balance'] });
              queryClient.invalidateQueries({ queryKey: ['gift-config'] });
              queryClient.invalidateQueries({ queryKey: ['gift-sent'] });
              onPurchaseComplete();
            } else if (status === 'failed') {
              haptic.notification('error');
              setSubmitError(t('gift.failedDesc'));
            }
            // 'cancelled' — user closed the invoice, do nothing
          } catch {
            setSubmitError(t('gift.failedDesc'));
          }
          return;
        }
        // Non-Stars provider (SBP …): open externally inside Telegram so
        // a bank-app hand-off via custom scheme doesn't dead-end in the WebView (#654272).
        openPaymentUrl(result.payment_url, platform, openLink);
      } else {
        // Balance purchase: switch to MyGifts tab so the new code is visible
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        queryClient.invalidateQueries({ queryKey: ['gift-config'] });
        queryClient.invalidateQueries({ queryKey: ['gift-sent'] });
        onPurchaseComplete();
      }
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, t('gift.failedDesc'));
      setSubmitError(msg);
    },
  });

  // Submit handler
  const handleSubmit = () => {
    if (!selectedTariffId || !selectedPeriodDays || !canSubmit || purchaseMutation.isPending)
      return;

    setSubmitError(null);

    let paymentMethod: string | undefined;
    if (paymentMode === 'gateway' && selectedMethod) {
      paymentMethod = selectedMethod;
      if (selectedSubOption) {
        paymentMethod = `${paymentMethod}_${selectedSubOption}`;
      }
    }

    const data: GiftPurchaseRequest = {
      tariff_id: selectedTariffId,
      period_days: selectedPeriodDays,
      payment_mode: paymentMode,
      payment_method: paymentMethod,
    };

    purchaseMutation.mutate(data);
  };

  // Balance label with current amount
  const balanceLabel = useMemo(() => {
    return `${t('gift.fromBalance')} (${formatPrice(config.balance_kopeks)})`;
  }, [config, t]);

  const showTariffCards = config.tariffs.length > 1;

  // Periods for the selected tariff (for period cards)
  const periodsForDisplay = useMemo(() => {
    if (selectedTariff) {
      return [...selectedTariff.periods].sort((a, b) => a.days - b.days);
    }
    return [];
  }, [selectedTariff]);

  return (
    <div className="space-y-6">
      {/* Tariff selection */}
      {showTariffCards && (
        <div>
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
            {t('gift.selectTariff')}
          </h2>
          <div role="radiogroup" aria-label={t('gift.chooseTariff')} className="space-y-2">
            {config.tariffs.map((tariff) => (
              <TariffCard
                key={tariff.id}
                tariff={tariff}
                isSelected={tariff.id === selectedTariffId}
                onSelect={() => setSelectedTariffId(tariff.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Selected tariff description */}
      {selectedTariff?.description && (
        <p className="-mt-3 px-1 text-[13px] leading-snug text-dark-400">
          {selectedTariff.description}
        </p>
      )}

      {/* Active discount banner */}
      {config.active_discount_percent != null && config.active_discount_percent > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-warning-500/10 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-500/20">
            <SparklesIcon className="h-4 w-4 text-warning-400" />
          </div>
          <div className="text-sm font-medium text-warning-400">
            {t('promo.discountApplied')} -{config.active_discount_percent}%
          </div>
        </div>
      )}

      {/* Period selection */}
      {periodsForDisplay.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
            {t('gift.selectPeriod')}
          </h2>
          <div className="space-y-2">
            {periodsForDisplay.map((period) => (
              <PeriodCard
                key={period.days}
                period={period}
                isSelected={period.days === selectedPeriodDays}
                onSelect={() => setSelectedPeriodDays(period.days)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Payment mode toggle */}
      <div>
        <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
          {t('gift.paymentMode')}
        </h2>
        <PaymentModeToggle
          mode={paymentMode}
          onToggle={setPaymentMode}
          balanceLabel={balanceLabel}
        />
      </div>

      {/* Payment method cards (gateway mode only) */}
      <AnimatePresence mode="wait">
        {paymentMode === 'gateway' && config.payment_methods.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div role="radiogroup" aria-label={t('gift.paymentMethod')} className="space-y-2">
              {config.payment_methods.map((method) => (
                <PaymentMethodCard
                  key={method.method_id}
                  method={method}
                  isSelected={method.method_id === selectedMethod}
                  selectedSubOption={method.method_id === selectedMethod ? selectedSubOption : null}
                  onSelect={() => {
                    setSelectedMethod(method.method_id);
                    if (method.sub_options && method.sub_options.length >= 1) {
                      setSelectedSubOption(method.sub_options[0].id);
                    } else {
                      setSelectedSubOption(null);
                    }
                  }}
                  onSelectSubOption={setSelectedSubOption}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary / Balance info */}
      {paymentMode === 'balance' && (
        <div className="rounded-3xl bg-dark-900/70 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-dark-300">{t('gift.yourBalance')}</span>
            <span className="text-[15px] font-semibold text-dark-100">
              {formatPrice(config.balance_kopeks)}
            </span>
          </div>
        </div>
      )}

      {/* Insufficient balance warning */}
      <AnimatePresence>
        {insufficientBalance && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl bg-warning-500/10 p-3"
          >
            <p className="text-sm text-warning-400">
              {t('gift.insufficientBalance')}{' '}
              <Link
                to="/balance"
                className="font-medium text-accent-400 underline underline-offset-2"
              >
                {t('gift.topUpBalance')}
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl bg-error-500/10 p-3"
          >
            <p className="text-sm text-error-400">{submitError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || purchaseMutation.isPending}
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-semibold transition-colors duration-200',
          canSubmit && !purchaseMutation.isPending
            ? 'bg-cta-500 text-on-cta hover:bg-cta-600 active:scale-[0.98]'
            : 'cursor-not-allowed bg-dark-800 text-dark-500',
        )}
      >
        {purchaseMutation.isPending ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <>
            {t('gift.giftButton')} {currentPrice > 0 ? formatPrice(currentPrice) : ''}
          </>
        )}
      </button>
    </div>
  );
}

function ActivateTabContent({ initialCode }: { initialCode?: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState(initialCode ?? '');

  // Sync when initialCode changes (e.g. URL param update while tab is active)
  useEffect(() => {
    if (initialCode) setCode(initialCode);
  }, [initialCode]);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);

  const stopScan = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .catch(() => undefined)
        .finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
    }
    setScanning(false);
  }, []);

  // Веб-сканер держит камеру: гасим его при уходе с вкладки/размонтировании,
  // иначе индикатор камеры остаётся гореть.
  useEffect(() => stopScan, [stopScan]);

  const applyScannedCode = useCallback(
    (decoded: string) => {
      const parsed = parseGiftCode(decoded);
      if (!parsed) {
        setActivateError(t('gift.scanNotRecognized'));
        return;
      }
      setCode(parsed);
      setActivateError(null);
    },
    [t],
  );

  const handleScan = useCallback(async () => {
    setActivateError(null);

    if (canUseTelegramScanner()) {
      try {
        const decoded = await scanWithTelegram(
          t('gift.scanDescription'),
          (v) => parseGiftCode(v) !== null,
        );
        if (decoded) applyScannedCode(decoded);
      } catch {
        setActivateError(t('gift.scanError'));
      }
      return;
    }

    const Html5Qrcode = await loadHtml5Qrcode();
    if (!Html5Qrcode) {
      setActivateError(t('gift.scanNoCamera'));
      return;
    }

    setScanning(true);
    const scanner = new Html5Qrcode('gift-qr-reader');
    scannerRef.current = scanner;
    const config = { fps: 10, qrbox: { width: 220, height: 220 } };
    const onDecoded = (decoded: string) => {
      if (parseGiftCode(decoded) === null) return;
      stopScan();
      applyScannedCode(decoded);
    };
    try {
      await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => undefined);
    } catch {
      try {
        await scanner.start({ facingMode: 'user' }, config, onDecoded, () => undefined);
      } catch {
        setActivateError(t('gift.scanNoCamera'));
        scannerRef.current = null;
        setScanning(false);
      }
    }
  }, [applyScannedCode, stopScan, t]);

  const activateMutation = useMutation({
    mutationFn: (giftCode: string) => giftApi.activateGiftCode(giftCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-received'] });
      queryClient.invalidateQueries({ queryKey: ['gift-sent'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
    onError: (err) => {
      const raw = getApiErrorMessage(err, '');
      const msg =
        raw === 'Cannot activate your own gift'
          ? t('gift.activateSelfError')
          : raw || t('gift.activateError');
      setActivateError(msg);
    },
  });

  const handleActivate = () => {
    const trimmed = code.trim();
    if (!trimmed || activateMutation.isPending) return;
    setActivateError(null);
    activateMutation.mutate(trimmed);
  };

  if (activateMutation.isSuccess && activateMutation.data) {
    const result = activateMutation.data;
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <RowIcon tone="success">
          <CheckCircleIcon />
        </RowIcon>
        <h2 className="text-lg font-bold text-dark-50">{t('gift.activateSuccess')}</h2>
        <p className="text-sm text-dark-300">
          {t('gift.activateSuccessDesc', {
            tariff: plainTariffName(result.tariff_name) ?? '',
            days: result.period_days ?? 0,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Icon + title */}
      <div className="flex flex-col items-center gap-3 text-center [overflow-wrap:anywhere]">
        <RowIcon>
          <KeyIcon />
        </RowIcon>
        <h2 className="text-lg font-bold text-dark-50">{t('gift.activateTitle')}</h2>
        <p className="max-w-xs text-sm text-dark-400">{t('gift.activateDescription')}</p>
      </div>

      {/* Code input */}
      <div className="w-full max-w-sm">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setActivateError(null);
          }}
          placeholder={t('gift.activateCodePlaceholder')}
          className="h-12 w-full rounded-2xl bg-dark-800/60 px-4 text-center text-[15px] font-semibold tracking-wide text-dark-50 placeholder-dark-500 outline-none transition-colors focus:ring-accent-500/50"
          aria-label={t('gift.activateTitle')}
        />

        {/* Скан QR: в Telegram — нативный сканер (в WebView камера через
            getUserMedia работает ненадёжно), в вебе — html5-qrcode. */}
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="mt-3 h-12 w-full rounded-2xl bg-dark-800/70 px-6 text-[15px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/70 disabled:opacity-50"
        >
          {scanning ? t('gift.scanInProgress') : t('gift.scanButton')}
        </button>

        {/* Контейнер веб-сканера: html5-qrcode рендерит превью камеры внутрь */}
        <div
          id="gift-qr-reader"
          className={cn('mt-3 overflow-hidden rounded-2xl', !scanning && 'hidden')}
        />
        {scanning && (
          <button
            type="button"
            onClick={stopScan}
            className="mt-2 h-10 w-full rounded-2xl px-6 text-sm font-semibold text-dark-300 transition-colors hover:bg-dark-800/50"
          >
            {t('gift.scanCancel')}
          </button>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {activateError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full max-w-sm rounded-2xl bg-error-500/10 p-3"
          >
            <p className="text-center text-sm text-error-400">{activateError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        type="button"
        onClick={handleActivate}
        disabled={!code.trim() || activateMutation.isPending}
        className={cn(
          'h-12 w-full max-w-sm rounded-2xl px-6 text-[15px] font-semibold transition-colors duration-200',
          code.trim() && !activateMutation.isPending
            ? 'bg-cta-500 text-on-cta hover:bg-cta-600 active:scale-[0.98]'
            : 'cursor-not-allowed bg-dark-800 text-dark-500',
        )}
      >
        {activateMutation.isPending ? (
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          t('gift.activateButton')
        )}
      </button>
    </div>
  );
}

function CopiedToast({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      // На мобильном стоит над нижней панелью: на bottom-6 тост целиком уходил за неё.
      className="fixed inset-x-0 bottom-[var(--mobile-nav-clearance)] z-50 flex justify-center lg:bottom-6"
    >
      <div className="flex items-center gap-2 rounded-full bg-dark-900 px-5 py-2.5">
        <CheckIcon className="h-4 w-4 text-success-400" />
        <span className="text-sm font-medium text-success-400">{t('gift.shareToastCopied')}</span>
      </div>
    </motion.div>
  );
}

function SentGiftCard({ gift }: { gift: SentGift }) {
  const { t } = useTranslation();
  const [showToast, setShowToast] = useState(false);

  // Runtime bot username (env var is only a fallback) so the "activate via bot"
  // line never silently disappears when VITE_TELEGRAM_BOT_USERNAME is unset.
  const { data: widgetConfig } = useQuery<TelegramWidgetConfig>({
    queryKey: ['telegram-widget-config'],
    queryFn: brandingApi.getTelegramWidgetConfig,
    staleTime: 60000,
  });
  const botUsername =
    widgetConfig?.bot_username || import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';

  const artifacts = buildGiftClaimArtifacts(gift, {
    botUsername,
    origin: window.location.origin,
  });
  const giftCode = artifacts.code;
  const isActivated = isGiftActivated(gift);
  const isAvailable = !isActivated && isGiftAvailable(gift.status);

  const statusText = isActivated
    ? t('gift.statusActivated')
    : isAvailable
      ? t('gift.statusAvailable')
      : t(getGiftStatusKey(gift.status));

  const buildShareMessage = useCallback(() => {
    // Literal "GIFT_" prefix: Telegram forwards the start param to the bot
    // verbatim (no URL-decoding), so the previously-encoded "%5F" never matched
    // the bot's `start_parameter.startswith('GIFT_')` handler.
    return [
      t('gift.shareText'),
      '',
      artifacts.botLink ? `${t('gift.shareModalActivateVia')} ${artifacts.botLink}` : null,
      `${t('gift.shareModalActivateViaCabinet')} ${artifacts.cabinetLink}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [artifacts.botLink, artifacts.cabinetLink, t]);

  const handleShare = useCallback(async () => {
    const message = buildShareMessage();
    await copyToClipboard(message);
    setShowToast(true);
  }, [buildShareMessage]);

  const handleDismissToast = useCallback(() => setShowToast(false), []);

  return (
    <div className="rounded-3xl bg-dark-900/70 p-4">
      {/* Header: tariff name + status badge */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-[15px] font-semibold text-dark-50">
          {plainTariffName(gift.tariff_name) ?? t('gift.tariff')}
        </h3>
        <Chip tone={!isActivated && isAvailable ? 'success' : 'muted'}>{statusText}</Chip>
      </div>

      {/* Info line */}
      <p className="mb-3 text-[13px] text-dark-400">
        {formatGiftDate(gift.created_at)}
        {' \u2022 '}
        {isLifetimePeriod(gift.period_days)
          ? t('subscription.lifetime.forever')
          : `${gift.period_days} ${t('gift.daysShort')}`}
        {' \u2022 '}
        {gift.device_limit} {t('gift.devicesShort', { count: gift.device_limit })}
      </p>

      {/* Gift code + actions (only when not activated) */}
      {!isActivated && (
        <>
          {/* Gift code display */}
          <div className="mb-3 rounded-2xl bg-dark-800/60 px-4 py-3 text-center">
            <p className="break-all text-[15px] font-semibold tracking-wide text-accent-400">
              {giftCode}
            </p>
          </div>

          {/* Share button — copies message and shows toast */}
          <button
            type="button"
            onClick={handleShare}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cta-500 px-4 text-[15px] font-semibold text-on-cta transition-colors hover:bg-cta-600 active:scale-[0.98]"
          >
            <ExportIcon className="h-4 w-4" />
            {t('gift.shareGift')}
          </button>
        </>
      )}

      {/* Activated by */}
      {isActivated && gift.activated_by_username && (
        <p className="mt-2 text-xs text-dark-500">
          {t('gift.activatedBy', { username: gift.activated_by_username })}
        </p>
      )}

      {/* Sent to */}
      {gift.gift_recipient_value && (
        <p className="mt-1 text-xs text-dark-500">
          {t('gift.sentTo', { recipient: gift.gift_recipient_value })}
        </p>
      )}

      {/* Copied toast — portal to escape motion.div transform context */}
      {createPortal(
        <AnimatePresence>
          {showToast && <CopiedToast onDismiss={handleDismissToast} />}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function ReceivedGiftCard({ gift }: { gift: ReceivedGift }) {
  const { t } = useTranslation();

  const statusKey = getGiftStatusKey(gift.status);
  const statusText = t(statusKey);

  return (
    <div className="rounded-3xl bg-dark-900/70 p-4">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-[15px] font-semibold text-dark-50">
          {plainTariffName(gift.tariff_name) ?? t('gift.tariff')}
        </h3>
        <Chip tone="muted">{statusText}</Chip>
      </div>

      {/* Info line */}
      <p className="mb-2 text-[13px] text-dark-400">
        {formatGiftDate(gift.created_at)}
        {' \u2022 '}
        {isLifetimePeriod(gift.period_days)
          ? t('subscription.lifetime.forever')
          : `${gift.period_days} ${t('gift.daysShort')}`}
        {' \u2022 '}
        {gift.device_limit} {t('gift.devicesShort', { count: gift.device_limit })}
      </p>

      {/* Sender */}
      {gift.sender_display && (
        <p className="text-xs text-dark-500">
          {t('gift.pending.from', { sender: gift.sender_display })}
        </p>
      )}

      {/* Gift message */}
      {gift.gift_message && (
        <div className="mt-2 rounded-2xl bg-dark-800/50 p-3">
          <p className="text-[13px] text-dark-300">{gift.gift_message}</p>
        </div>
      )}
    </div>
  );
}

function MyGiftsTabContent() {
  const { t } = useTranslation();

  const {
    data: sentGifts,
    isLoading: sentLoading,
    error: sentError,
  } = useQuery({
    queryKey: ['gift-sent'],
    queryFn: giftApi.getSentGifts,
    staleTime: 30_000,
  });

  const {
    data: receivedGifts,
    isLoading: receivedLoading,
    error: receivedError,
  } = useQuery({
    queryKey: ['gift-received'],
    queryFn: giftApi.getReceivedGifts,
    staleTime: 30_000,
  });

  const isLoading = sentLoading || receivedLoading;

  // Split sent gifts into active (awaiting activation) and activated
  const activeGifts = useMemo(
    () => (sentGifts ?? []).filter((g) => !isGiftActivated(g)),
    [sentGifts],
  );
  const activatedGifts = useMemo(
    () => (sentGifts ?? []).filter((g) => isGiftActivated(g)),
    [sentGifts],
  );

  const hasActive = activeGifts.length > 0;
  const hasActivated = activatedGifts.length > 0;
  const hasReceived = receivedGifts && receivedGifts.length > 0;
  const isEmpty = !hasActive && !hasActivated && !hasReceived;

  if (isLoading) {
    return (
      <SkeletonGroup className="space-y-3">
        <Skeleton variant="card" count={3} className="h-24 rounded-3xl" />
      </SkeletonGroup>
    );
  }

  if (sentError || receivedError) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm text-error-400">{t('gift.failedDesc')}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={<InboxIcon />}
        title={t('gift.myGiftsEmpty')}
        text={t('gift.myGiftsEmptyDesc')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Active gifts (awaiting activation) */}
      {hasActive && (
        <div>
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
            {t('gift.activeGiftsTitle')}
          </h2>
          <div className="space-y-3">
            {activeGifts.map((gift) => (
              <SentGiftCard key={gift.token} gift={gift} />
            ))}
          </div>
        </div>
      )}

      {/* Activated gifts */}
      {hasActivated && (
        <div>
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
            {t('gift.activatedGiftsTitle')}
          </h2>
          <div className="space-y-3">
            {activatedGifts.map((gift) => (
              <SentGiftCard key={gift.token} gift={gift} />
            ))}
          </div>
        </div>
      )}

      {/* Received gifts */}
      {hasReceived && (
        <div>
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
            {t('gift.receivedGiftsTitle')}
          </h2>
          <div className="space-y-3">
            {receivedGifts?.map((gift) => (
              <ReceivedGiftCard key={gift.token} gift={gift} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const tabContentVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export default function GiftSubscription() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Прогреваем кэш курсов валют для formatPrice.
  useCurrency();

  // URL params: ?tab=activate&code=TOKEN for auto-activation
  const urlTab = searchParams.get('tab') as TabId | null;
  const rawCode = searchParams.get('code');
  // Strip GIFT- or GIFT_ prefix if user pasted the full display code
  const urlCode = rawCode?.replace(/^GIFT[-_]/i, '') ?? rawCode;
  const [activeTab, setActiveTab] = useState<TabId>(
    urlTab === 'activate' || urlTab === 'myGifts' ? urlTab : 'buy',
  );

  // Fetch config
  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['gift-config'],
    queryFn: giftApi.getConfig,
    staleTime: 30_000,
  });

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error || !config) {
    const errMsg = getApiErrorMessage(error, t('gift.notFound'));
    return <ErrorState message={errMsg} />;
  }

  // Disabled state
  if (!config.is_enabled) {
    return <DisabledState />;
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'buy', label: t('gift.tabBuy') },
    { id: 'activate', label: t('gift.tabActivate') },
    { id: 'myGifts', label: t('gift.tabMyGifts') },
  ];

  return (
    <Page>
      <div>
        <PageHeader title={t('gift.pageTitle')} backTo="/profile" />

        {/* Tab bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mb-6 rounded-2xl bg-dark-900/70 p-1"
        >
          <div className="flex" role="tablist" aria-label={t('gift.pageTitle')}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                // Равные вкладки, узкие поля и шрифт на телефоне: «Мои подарки»
                // переносилась в две строки, и пилюля была выше соседних.
                className={cn(
                  'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-xl px-1.5 py-2.5 text-[13px] font-semibold transition-colors duration-200 sm:px-3 sm:text-sm',
                  activeTab === tab.id
                    ? 'bg-dark-800 text-dark-50'
                    : 'text-dark-400 hover:text-dark-200',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'buy' && (
              <BuyTabContent config={config} onPurchaseComplete={() => setActiveTab('myGifts')} />
            )}
            {activeTab === 'activate' && <ActivateTabContent initialCode={urlCode} />}
            {activeTab === 'myGifts' && <MyGiftsTabContent />}
          </motion.div>
        </AnimatePresence>
      </div>
    </Page>
  );
}
