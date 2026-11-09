import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Page, RowIcon, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { PiInfoDuotone, PiSparkleDuotone, PiWarningDuotone } from 'react-icons/pi';
import type { Tariff, ClassicPurchaseOptions } from '../types';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import { SwitchTariffSheet } from '../components/subscription/sheets/SwitchTariffSheet';
import { TariffPurchaseForm } from '../components/subscription/purchase/TariffPurchaseForm';
import { canOpenTariffSwitch, needsTariff } from '../utils/legacySubscription';
import { TariffPickerGrid } from '../components/subscription/purchase/TariffPickerGrid';
import { TariffPickerLite } from '../components/subscription/purchase/TariffPickerLite';
import { formatLiteDate } from '@/utils/liteDate';
import { isLifetimeSubscription } from '@/utils/lifetime';
import { useLiteMode } from '../hooks/useLiteMode';
import { ClassicPurchaseWizard } from '../components/subscription/purchase/ClassicPurchaseWizard';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { plainTariffName } from '@/utils/plainTariffName';

export default function SubscriptionPurchase() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get('subscriptionId')
    ? parseInt(searchParams.get('subscriptionId') ?? '', 10)
    : undefined;
  // Витрина тарифов в двух видах. Обработчики и данные общие, различается
  // только подача; что делает нажатие — решает tariffAction() внутри обеих.
  const { lite } = useLiteMode();
  const TariffPicker = lite ? TariffPickerLite : TariffPickerGrid;

  // Subscription query (shares cache with /subscription page)
  const { data: subscriptionResponse, isLoading } = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionApi.getSubscription(subscriptionId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // Purchase options
  const {
    data: purchaseOptions,
    isLoading: optionsLoading,
    isError: optionsError,
    refetch: refetchOptions,
  } = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Sales mode detection
  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';
  const classicOptions = !isTariffsMode ? (purchaseOptions as ClassicPurchaseOptions) : null;
  const tariffs =
    isTariffsMode && purchaseOptions && 'tariffs' in purchaseOptions ? purchaseOptions.tariffs : [];

  // Multi-tariff: check via subscriptions list query
  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  // (active promo discount + applyPromoDiscount live in usePromoDiscount;
  //  consumed directly by the sub-components, not threaded as props)

  // (classic-mode state moved into <ClassicPurchaseWizard>)

  // Tariffs mode state
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [showTariffPurchase, setShowTariffPurchase] = useState(false);
  // (selectedTariffPeriod / customDays / customTrafficGb / useCustomDays /
  //  useCustomTraffic moved into <TariffPurchaseForm>; form remounts with
  //  fresh state via key=tariff.id when the parent picks a new tariff)

  // (tariffPurchaseRef moved into <TariffPurchaseForm>; switch-modal ref
  //  moved into <SwitchTariffSheet>)

  // Tariff switch
  const [switchTariffId, setSwitchTariffId] = useState<number | null>(null);

  // Auto-close all modals on success notification
  const handleCloseAllModals = () => {
    // setShowPurchaseForm moved into <ClassicPurchaseWizard>'s own useCloseOnSuccessNotification
    setShowTariffPurchase(false);
    setSwitchTariffId(null);

    setSelectedTariff(null);
    // (selectedTariffPeriod lives inside <TariffPurchaseForm> now; unmount clears it)
  };
  useCloseOnSuccessNotification(handleCloseAllModals);

  // (switch preview query + switchTariffMutation moved into <SwitchTariffSheet>)

  // (tariffPurchaseMutation moved into <TariffPurchaseForm>)
  // (auto-scroll effects: switch-modal into <SwitchTariffSheet>,
  //  tariff-purchase into <TariffPurchaseForm>)

  // (classic-mode helpers moved into <ClassicPurchaseWizard>)

  const backTo = subscriptionId ? `/subscriptions/${subscriptionId}` : '/subscriptions';

  if (isLoading || optionsLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-56">
        <Skeleton variant="card" className="h-32" />
        <Skeleton variant="card" count={2} className="h-40" />
      </PageSkeleton>
    );
  }

  if (optionsError || (!purchaseOptions && !optionsLoading)) {
    return (
      <Page>
        <PageHeader title={t('subscription.extend')} backTo={backTo} />
        <EmptyState
          icon={<PiWarningDuotone />}
          title={t('subscription.loadError', 'Не удалось загрузить варианты подписки')}
          action={<Button onClick={() => refetchOptions()}>{t('common.retry')}</Button>}
        />
      </Page>
    );
  }

  const isScopedSwitch =
    isTariffsMode &&
    subscriptionId === subscription?.id &&
    canOpenTariffSwitch(subscription) &&
    !(
      purchaseOptions &&
      'subscription_on_free_tariff' in purchaseOptions &&
      purchaseOptions.subscription_on_free_tariff
    );

  if (isScopedSwitch && subscription && !showTariffPurchase) {
    return (
      <Page>
        <PageHeader
          title={t('subscription.switchTariff.title')}
          backTo={`/subscriptions/${subscription.id}`}
        />
        <Surface>
          <p className="text-[13px] font-medium text-dark-400">
            {t('subscription.v10.currentTariffLabel', 'Сейчас')}
          </p>
          <p className="mt-0.5 break-words text-[17px] font-bold text-dark-50">
            {plainTariffName(subscription.tariff_name)}
          </p>
          {!subscription.is_daily && subscription.end_date && (
            <p className="mt-1 text-[13px] text-dark-400">
              {isLifetimeSubscription(subscription)
                ? `${t('subscription.lifetime.term')}: ${t('subscription.lifetime.forever')}`
                : t('subscription.switchTariff.validUntil', {
                    date: formatLiteDate(subscription.end_date),
                  })}
            </p>
          )}
        </Surface>
        <div>
          {switchTariffId === null ? (
            <>
              <p className="mb-3 px-1 text-[13px] text-dark-400">
                {t('subscription.switchTariff.chooseHint')}
              </p>
              {tariffs.some(
                (tariff) => tariff.id !== subscription.tariff_id && !tariff.is_purchased,
              ) ? (
                <TariffPicker
                  tariffs={tariffs.filter(
                    (tariff) => tariff.id !== subscription.tariff_id && !tariff.is_purchased,
                  )}
                  subscription={subscription}
                  purchaseOptions={purchaseOptions}
                  isTariffsMode={isTariffsMode}
                  isMultiTariff={isMultiTariff}
                  subscriptionId={subscriptionId}
                  switchSelection
                  onSelectTariff={(tariff) => setSwitchTariffId(tariff.id)}
                  onSwitchTariff={setSwitchTariffId}
                />
              ) : (
                <EmptyState title={t('subscription.switchTariff.noAlternatives')} />
              )}
            </>
          ) : (
            <SwitchTariffSheet
              open
              tariffId={switchTariffId}
              subscriptionId={subscriptionId}
              subscription={subscription}
              tariffs={tariffs}
              onClose={() => setSwitchTariffId(null)}
              onExpiredFallback={(tariff) => {
                setSelectedTariff(tariff);
                setShowTariffPurchase(true);
              }}
            />
          )}
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        backTo={backTo}
        title={
          needsTariff(subscription)
            ? t('subscription.cta.moveToTariff')
            : isTariffsMode && subscriptionId && canOpenTariffSwitch(subscription)
              ? t('subscription.switchTariff.title')
              : isMultiTariff && !subscriptionId
                ? t('subscription.newTariff', 'Новый тариф')
                : !isMultiTariff && subscription?.is_daily && !subscription?.is_trial
                  ? t('subscription.switchTariff.title')
                  : isLifetimeSubscription(subscription)
                    ? t('subscription.switchTariff.title')
                    : subscription && !subscription.is_trial
                      ? t('subscription.extend')
                      : t('subscription.getSubscription')
        }
      />

      {/* Tariffs Section */}
      {isTariffsMode && tariffs.length > 0 && (
        <div className="space-y-6">
          {/* Trial upgrade prompt — hidden when expired banner is active */}
          {subscription?.is_trial &&
            !(
              isTariffsMode &&
              purchaseOptions &&
              'subscription_is_expired' in purchaseOptions &&
              purchaseOptions.subscription_is_expired
            ) && (
              <Notice
                tone="accent"
                icon={<PiSparkleDuotone />}
                title={t('subscription.trialUpgrade.title')}
                text={t('subscription.trialUpgrade.description')}
              />
            )}

          {/* Expired subscription notice */}
          {isTariffsMode &&
            purchaseOptions &&
            'subscription_is_expired' in purchaseOptions &&
            purchaseOptions.subscription_is_expired && (
              <Notice
                tone="error"
                icon={<PiWarningDuotone />}
                title={t('subscription.expiredBanner.title')}
                text={t('subscription.expiredBanner.selectTariff')}
              />
            )}

          {/* Старая подписка (куплена в классике, тарифа нет): тариф надевается на неё же */}
          {needsTariff(subscription) && (
            <Notice
              tone="accent"
              icon={<PiInfoDuotone />}
              title={t('subscription.legacy.selectTariffTitle')}
              text={`${t('subscription.legacy.selectTariffDescription')} ${t('subscription.legacy.currentSubContinues')}`}
            />
          )}

          {/* Switch Tariff Preview Modal */}
          <SwitchTariffSheet
            open={switchTariffId !== null}
            tariffId={switchTariffId}
            subscriptionId={subscriptionId}
            tariffs={tariffs}
            onClose={() => setSwitchTariffId(null)}
            onExpiredFallback={(tariff) => {
              setSelectedTariff(tariff);
              setShowTariffPurchase(true);
            }}
          />

          {!showTariffPurchase ? (
            <TariffPicker
              tariffs={tariffs}
              subscription={subscription}
              purchaseOptions={purchaseOptions}
              isTariffsMode={isTariffsMode}
              isMultiTariff={isMultiTariff}
              subscriptionId={subscriptionId}
              onSelectTariff={(tariff) => {
                setSelectedTariff(tariff);
                setShowTariffPurchase(true);
              }}
              onSwitchTariff={(tariffId) => setSwitchTariffId(tariffId)}
            />
          ) : (
            selectedTariff && (
              /* Tariff Purchase Form (extracted into its own component) */
              <TariffPurchaseForm
                key={selectedTariff.id}
                tariff={selectedTariff}
                subscriptionId={subscriptionId}
                balanceKopeks={purchaseOptions?.balance_kopeks}
                sbpPurchaseEnabled={
                  isTariffsMode &&
                  purchaseOptions !== undefined &&
                  'platega_recurrent_enabled' in purchaseOptions &&
                  purchaseOptions.platega_recurrent_enabled === true
                }
                onBack={() => {
                  setShowTariffPurchase(false);
                  setSelectedTariff(null);
                }}
              />
            )
          )}
        </div>
      )}

      {/* Purchase/Extend Section - Classic Mode */}
      {classicOptions && classicOptions.periods.length > 0 && (
        <ClassicPurchaseWizard
          classicOptions={classicOptions}
          subscription={subscription}
          subscriptionId={subscriptionId}
        />
      )}

      {/* No options available fallback */}
      {purchaseOptions &&
        !optionsLoading &&
        !(isTariffsMode && tariffs.length > 0) &&
        !(classicOptions && classicOptions.periods.length > 0) && (
          <EmptyState
            title={t('subscription.noOptionsAvailable', 'Нет доступных вариантов подписки')}
            action={<Button onClick={() => refetchOptions()}>{t('common.retry')}</Button>}
          />
        )}
    </Page>
  );
}

/** Пояснение над витриной: пробный период, истёкшая подписка, старая подписка. */
function Notice({
  tone,
  icon,
  title,
  text,
}: {
  tone: 'accent' | 'error';
  icon: ReactNode;
  title: ReactNode;
  text: ReactNode;
}) {
  return (
    <Surface
      className={cn(
        'flex items-start gap-3',
        tone === 'error' ? 'bg-error-500/5' : 'bg-accent-500/15',
      )}
    >
      <RowIcon tone={tone}>{icon}</RowIcon>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-dark-100">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-dark-400">{text}</p>
      </div>
    </Surface>
  );
}
