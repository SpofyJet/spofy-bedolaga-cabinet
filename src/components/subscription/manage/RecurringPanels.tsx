import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import { usePlatform } from '@/platform';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import { useToast } from '@/components/Toast';
import type { Subscription } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';
import { PiCreditCardDuotone } from 'react-icons/pi';
import { RowIcon } from '@/components/spofy/ui';
import { openPaymentUrl } from '@/utils/openPaymentUrl';
import { uiLocale } from '@/utils/uiLocale';
import {
  isLavaFeatureDisabledError,
  lavaPeriodLabelKey,
  lavaUiState,
  type LavaUiState,
} from '@/utils/lavaRecurring';
import {
  casheraIntervalLabelKey,
  casheraUiState,
  isCasheraFeatureDisabledError,
  type CasheraUiState,
} from '@/utils/casheraRecurring';
import { isRecurringFeatureOff } from '@/utils/recurringFeature';
import { isLifetimeSubscription } from '@/utils/lifetime';
import {
  isSbpFeatureDisabledError,
  sbpIntervalLabelKey,
  sbpUiState,
  type SbpUiState,
} from '@/utils/sbpRecurring';

export interface RecurringPanelsProps {
  subscription: Subscription;
  subscriptionId: number | undefined;
}

/**
 * Автосписания СБП (Platega), Lava и Cashera — независимые движки с одинаковой
 * семантикой, поэтому живут одним компонентом.
 *
 * Вынесены из тела страницы подписки, чтобы ими мог пользоваться простой вид.
 * Опции покупки компонент спрашивает сам: они нужны ему ради признака
 * «фича включена», а ключ запроса тот же, что и у страницы, так что второго
 * похода в сеть не возникает.
 *
 * Состояние автооплаты спрашивается только у включённой фичи: иначе бэкенд
 * отвечает 403 на каждую подписку, и консоль заливается красными стеками.
 */
export function RecurringPanels({ subscription, subscriptionId }: RecurringPanelsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openLink, platform } = usePlatform();
  const destructiveConfirm = useDestructiveConfirm();
  const { showToast } = useToast();
  const { formatAmount } = useCurrency();

  // Вечной подписке включать автосписание не предлагаем — продлевать нечего.
  // Уже подключённое (active/pending/past_due) остаётся видно, чтобы его можно
  // было отключить.
  const lifetime = isLifetimeSubscription(subscription);
  const offerable = <S extends string>(state: S): S | 'hidden' =>
    lifetime && state === 'off' ? 'hidden' : state;

  const purchaseOptionsQuery = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
  });
  const purchaseOptions = purchaseOptionsQuery.data;

  // Состояние автооплаты спрашиваем, только когда она включена: иначе бэкенд
  // отвечает 403, и браузер печатает красную строку с полным стеком на каждый
  // такой запрос. Ждём ответа опций — до него неизвестно, включена ли фича.
  const featureFlagsSettled = purchaseOptionsQuery.isSuccess || purchaseOptionsQuery.isError;
  const sbpFeatureOff = isRecurringFeatureOff(purchaseOptions, 'platega_recurrent_enabled');
  const lavaFeatureOff = isRecurringFeatureOff(purchaseOptions, 'lava_recurrent_enabled');
  const casheraFeatureOff = isRecurringFeatureOff(purchaseOptions, 'cashera_recurrent_enabled');

  // SBP (Platega) recurring auto-payment status. Polls every 8s while a
  // payment is PENDING (waiting for bank-app confirmation) so the UI flips
  // to 'active'/'past_due' without a manual refresh; stops polling otherwise.
  const sbpQuery = useQuery({
    queryKey: ['sbp-recurring', subscriptionId],
    queryFn: () => subscriptionApi.getSbpRecurring(subscriptionId),
    enabled: !!subscription && !subscription.is_trial && featureFlagsSettled && !sbpFeatureOff,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 8000 : false),
  });
  const sbpInfo = sbpQuery.data;
  // 403 with a specific detail means the feature itself is disabled on the
  // backend — distinct from "not resolved yet" or "other error", both of
  // which must fail quiet (render nothing) rather than flash the 'off' state.
  const sbpFeatureDisabled = sbpFeatureOff || isSbpFeatureDisabledError(sbpQuery.error);
  const sbpUiStateValue: SbpUiState =
    sbpInfo !== undefined || sbpFeatureDisabled
      ? offerable(sbpUiState(sbpInfo, sbpFeatureDisabled))
      : 'hidden';

  const enableSbpMutation = useMutation({
    mutationFn: () => subscriptionApi.enableSbpRecurring(subscriptionId),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['sbp-recurring', subscriptionId] });
      // Backend flips autopay_enabled off when SBP auto-pay is enabled.
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      showToast({
        type: 'error',
        title: typeof detail === 'string' ? detail : t('subscription.sbpRecurring.enableError'),
        message: '',
        duration: 3000,
      });
    },
  });

  const cancelSbpMutation = useMutation({
    mutationFn: () => subscriptionApi.cancelSbpRecurring(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sbp-recurring', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      showToast({
        type: 'success',
        title: t('subscription.sbpRecurring.cancelled'),
        message: '',
        duration: 3000,
      });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      showToast({
        type: 'error',
        title: typeof detail === 'string' ? detail : t('subscription.sbpRecurring.cancelError'),
        message: '',
        duration: 3000,
      });
    },
  });

  const handleCancelSbp = async () => {
    const confirmed = await destructiveConfirm(
      t('subscription.sbpRecurring.confirmCancel'),
      t('subscription.sbpRecurring.cancel'),
    );
    if (!confirmed) return;
    cancelSbpMutation.mutate();
  };

  // Автопродление Lava — независимый от Platega движок с той же семантикой
  // состояний. Поллинг раз в 8с, пока привязка PENDING (ждём оплату первого
  // счёта), чтобы UI сам перешёл в active/past_due.
  const lavaQuery = useQuery({
    queryKey: ['lava-recurring', subscriptionId],
    queryFn: () => subscriptionApi.getLavaRecurring(subscriptionId),
    enabled: !!subscription && !subscription.is_trial && featureFlagsSettled && !lavaFeatureOff,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 8000 : false),
  });
  const lavaInfo = lavaQuery.data;
  const lavaFeatureDisabled = lavaFeatureOff || isLavaFeatureDisabledError(lavaQuery.error);
  const lavaUiStateValue: LavaUiState =
    lavaInfo !== undefined || lavaFeatureDisabled
      ? offerable(lavaUiState(lavaInfo, lavaFeatureDisabled))
      : 'hidden';

  const enableLavaMutation = useMutation({
    mutationFn: () => subscriptionApi.enableLavaRecurring(subscriptionId),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['lava-recurring', subscriptionId] });
      // Бэкенд снимает autopay_enabled при включении рекуррента провайдера.
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      showToast({
        type: 'error',
        title: typeof detail === 'string' ? detail : t('subscription.lavaRecurring.enableError'),
        message: '',
        duration: 3000,
      });
    },
  });

  const cancelLavaMutation = useMutation({
    mutationFn: () => subscriptionApi.cancelLavaRecurring(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lava-recurring', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      showToast({
        type: 'success',
        title: t('subscription.lavaRecurring.cancelled'),
        message: '',
        duration: 3000,
      });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      showToast({
        type: 'error',
        title: typeof detail === 'string' ? detail : t('subscription.lavaRecurring.cancelError'),
        message: '',
        duration: 3000,
      });
    },
  });

  const handleCancelLava = async () => {
    const confirmed = await destructiveConfirm(
      t('subscription.lavaRecurring.confirmCancel'),
      t('subscription.lavaRecurring.cancel'),
    );
    if (!confirmed) return;
    cancelLavaMutation.mutate();
  };

  // Автопродление Cashera — третий движок с той же семантикой состояний.
  // Поллинг раз в 8с, пока привязка PENDING (ждём подтверждения по ссылке).
  const casheraQuery = useQuery({
    queryKey: ['cashera-recurring', subscriptionId],
    queryFn: () => subscriptionApi.getCasheraRecurring(subscriptionId),
    enabled: !!subscription && !subscription.is_trial && featureFlagsSettled && !casheraFeatureOff,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 8000 : false),
  });
  const casheraInfo = casheraQuery.data;
  const casheraFeatureDisabled =
    casheraFeatureOff || isCasheraFeatureDisabledError(casheraQuery.error);
  const casheraUiStateValue: CasheraUiState =
    casheraInfo !== undefined || casheraFeatureDisabled
      ? offerable(casheraUiState(casheraInfo, casheraFeatureDisabled))
      : 'hidden';

  const enableCasheraMutation = useMutation({
    mutationFn: () => subscriptionApi.enableCasheraRecurring(subscriptionId),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['cashera-recurring', subscriptionId] });
      // Бэкенд снимает autopay_enabled при включении рекуррента провайдера.
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      showToast({
        type: 'error',
        title: typeof detail === 'string' ? detail : t('subscription.casheraRecurring.enableError'),
        message: '',
        duration: 3000,
      });
    },
  });

  const cancelCasheraMutation = useMutation({
    mutationFn: () => subscriptionApi.cancelCasheraRecurring(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashera-recurring', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      showToast({
        type: 'success',
        title: t('subscription.casheraRecurring.cancelled'),
        message: '',
        duration: 3000,
      });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      showToast({
        type: 'error',
        title: typeof detail === 'string' ? detail : t('subscription.casheraRecurring.cancelError'),
        message: '',
        duration: 3000,
      });
    },
  });

  const handleCancelCashera = async () => {
    const confirmed = await destructiveConfirm(
      t('subscription.casheraRecurring.confirmCancel'),
      t('subscription.casheraRecurring.cancel'),
    );
    if (!confirmed) return;
    cancelCasheraMutation.mutate();
  };

  const formatChargeDate = (iso: string) =>
    new Date(iso).toLocaleDateString(uiLocale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const lavaAmountLine = (() => {
    if (!lavaInfo) return null;
    const periodKey = lavaPeriodLabelKey(lavaInfo.charge_days);
    const amount = formatAmount((lavaInfo.amount_kopeks ?? 0) / 100);
    return periodKey
      ? t('subscription.lavaRecurring.amountPerPeriod', { amount, period: t(periodKey) })
      : t('subscription.lavaRecurring.amountPerDays', { amount, days: lavaInfo.charge_days ?? 0 });
  })();

  // Блоки ниже — сиблинги тоггла «Автопродление» с баланса и показываются
  // только по is_trial + своему состоянию: суточным тарифам они тоже нужны
  // (бэкенд умеет списание раз в сутки). Каждый способ — своя строка: способы
  // оплаты не группируем.
  return (
    <>
      {!subscription.is_trial && sbpUiStateValue !== 'hidden' && (
        <ProviderRow
          title={t('subscription.sbpRecurring.title')}
          state={sbpUiStateValue}
          hint={t('subscription.sbpRecurring.autopayHint')}
          pendingText={t('subscription.sbpRecurring.statusPending')}
          pastDueText={t('subscription.sbpRecurring.statusPastDue')}
          amountLine={
            sbpInfo
              ? t('subscription.sbpRecurring.amountPerInterval', {
                  amount: formatAmount((sbpInfo.amount_kopeks ?? 0) / 100),
                  interval: t(sbpIntervalLabelKey(sbpInfo.interval)),
                })
              : null
          }
          nextChargeLine={
            sbpInfo?.next_charge_at
              ? t('subscription.sbpRecurring.nextCharge', {
                  date: formatChargeDate(sbpInfo.next_charge_at),
                })
              : null
          }
          connectLabel={t('subscription.sbpRecurring.connect')}
          onConnect={() => enableSbpMutation.mutate()}
          connecting={enableSbpMutation.isPending}
          confirm={
            sbpInfo?.redirect_url
              ? {
                  label: t('subscription.sbpRecurring.confirmInBank'),
                  url: sbpInfo.redirect_url,
                }
              : undefined
          }
          onOpenUrl={(url) => openPaymentUrl(url, platform, openLink)}
          cancelLabel={t('subscription.sbpRecurring.cancel')}
          onCancel={handleCancelSbp}
          cancelling={cancelSbpMutation.isPending}
        />
      )}

      {/* Lava: период задан продуктом в кабинете Lava и приезжает числом
          дней, поэтому подпись строится из charge_days. */}
      {!subscription.is_trial && lavaUiStateValue !== 'hidden' && (
        <ProviderRow
          title={t('subscription.lavaRecurring.title')}
          state={lavaUiStateValue}
          hint={t('subscription.lavaRecurring.autopayHint')}
          pendingText={t('subscription.lavaRecurring.statusPending')}
          pastDueText={t('subscription.lavaRecurring.statusPastDue')}
          amountLine={lavaAmountLine}
          nextChargeLine={
            lavaInfo?.next_charge_at
              ? t('subscription.lavaRecurring.nextCharge', {
                  date: formatChargeDate(lavaInfo.next_charge_at),
                })
              : null
          }
          connectLabel={t('subscription.lavaRecurring.connect')}
          onConnect={() => enableLavaMutation.mutate()}
          connecting={enableLavaMutation.isPending}
          confirm={
            lavaInfo?.redirect_url
              ? { label: t('subscription.lavaRecurring.payFirst'), url: lavaInfo.redirect_url }
              : undefined
          }
          onOpenUrl={(url) => openPaymentUrl(url, platform, openLink)}
          cancelLabel={t('subscription.lavaRecurring.cancel')}
          onCancel={handleCancelLava}
          cancelling={cancelLavaMutation.isPending}
        />
      )}

      {/* Cashera: интервал задаётся при оформлении и приезжает строкой
          (daily/weekly/monthly/yearly). */}
      {!subscription.is_trial && casheraUiStateValue !== 'hidden' && (
        <ProviderRow
          title={t('subscription.casheraRecurring.title')}
          state={casheraUiStateValue}
          hint={t('subscription.casheraRecurring.autopayHint')}
          pendingText={t('subscription.casheraRecurring.statusPending')}
          pastDueText={t('subscription.casheraRecurring.statusPastDue')}
          amountLine={
            casheraInfo
              ? t('subscription.casheraRecurring.amountPerInterval', {
                  amount: formatAmount((casheraInfo.amount_kopeks ?? 0) / 100),
                  interval: t(casheraIntervalLabelKey(casheraInfo.interval)),
                })
              : null
          }
          nextChargeLine={
            casheraInfo?.next_charge_at
              ? t('subscription.casheraRecurring.nextCharge', {
                  date: formatChargeDate(casheraInfo.next_charge_at),
                })
              : null
          }
          connectLabel={t('subscription.casheraRecurring.connect')}
          onConnect={() => enableCasheraMutation.mutate()}
          connecting={enableCasheraMutation.isPending}
          confirm={
            casheraInfo?.redirect_url
              ? { label: t('subscription.casheraRecurring.confirm'), url: casheraInfo.redirect_url }
              : undefined
          }
          onOpenUrl={(url) => openPaymentUrl(url, platform, openLink)}
          cancelLabel={t('subscription.casheraRecurring.cancel')}
          onCancel={handleCancelCashera}
          cancelling={cancelCasheraMutation.isPending}
        />
      )}
    </>
  );
}

type ProviderState = 'off' | 'pending' | 'active' | 'past_due';

interface ProviderRowProps {
  title: string;
  state: ProviderState;
  /** Подпись под заголовком, пока автопродление не подключено. */
  hint: string;
  pendingText: string;
  pastDueText: string;
  amountLine: string | null;
  nextChargeLine: string | null;
  connectLabel: string;
  onConnect: () => void;
  connecting: boolean;
  /** Ссылка подтверждения привязки, пока она ждёт (банк, первый счёт). */
  confirm?: { label: string; url: string };
  onOpenUrl: (url: string) => void;
  cancelLabel: string;
  onCancel: () => void;
  cancelling: boolean;
}

const COMPACT_BUTTON =
  'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-50';
/** «Подключить» — вторичная кнопка: на странице одна главная кнопка, а не стена акцентных. */
const CONNECT_BUTTON = `${COMPACT_BUTTON} bg-dark-800/70 text-accent-300 ring-1 ring-inset ring-dark-700/60 hover:bg-dark-700/70`;
/** Подтверждение ждущей привязки — единственное нужное сейчас действие строки. */
const CONFIRM_BUTTON = `${COMPACT_BUTTON} bg-accent-500/15 text-accent-300 hover:bg-accent-500/25`;
const CANCEL_BUTTON = `${COMPACT_BUTTON} px-2.5 text-error-400 hover:bg-error-500/10`;

/**
 * Строка одного способа автопродления: иконка, название и состояние, рядом —
 * компактное вторичное действие (на телефоне — под текстом, с sm — справа).
 */
function ProviderRow({
  title,
  state,
  hint,
  pendingText,
  pastDueText,
  amountLine,
  nextChargeLine,
  connectLabel,
  onConnect,
  connecting,
  confirm,
  onOpenUrl,
  cancelLabel,
  onCancel,
  cancelling,
}: ProviderRowProps) {
  const line = 'mt-0.5 text-[13px] leading-snug text-dark-400';

  return (
    <div className="px-4 py-3">
      {/* На телефоне действие — компактной кнопкой под текстом (справа текст
          сжимался в столбик), с sm — справа в строке. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <RowIcon>
            <PiCreditCardDuotone />
          </RowIcon>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-dark-100">{title}</div>
            {state === 'off' && <div className={line}>{hint}</div>}
            {state === 'pending' && <div className={line}>{pendingText}</div>}
            {state === 'active' && (
              <>
                {amountLine && <div className={line}>{amountLine}</div>}
                {nextChargeLine && <div className={line}>{nextChargeLine}</div>}
              </>
            )}
            {state === 'past_due' && (
              <div className="mt-0.5 text-[13px] font-medium text-warning-400">{pastDueText}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
          {state === 'off' ? (
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              className={CONNECT_BUTTON}
            >
              {connecting ? (
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                connectLabel
              )}
            </button>
          ) : (
            <>
              {state === 'pending' && confirm && (
                <button
                  type="button"
                  onClick={() => onOpenUrl(confirm.url)}
                  className={CONFIRM_BUTTON}
                >
                  {confirm.label}
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling}
                className={CANCEL_BUTTON}
              >
                {cancelLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecurringPanels;
