import { isUncertainPurchaseOutcome } from '@/utils/api-error';
import { useTranslation } from 'react-i18next';
import { formatGbShort } from '@/utils/formatNumber';
import { useCurrency } from '../../../hooks/useCurrency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage } from '../../../utils/subscriptionHelpers';
import InsufficientBalancePrompt from '../../InsufficientBalancePrompt';
import { PiChartPieSliceDuotone } from 'react-icons/pi';
import { Button, Chip, Row } from '@/components/spofy/ui';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { cn } from '@/lib/utils';
import { SheetBody, SheetNote, Spinner } from './sheetParts';
import type { PurchaseOptions, Subscription } from '../../../types';

// ──────────────────────────────────────────────────────────────────
// Buy-traffic sheet. Self-owns the packages query + purchase mutation;
// parent passes the selectedTrafficPackage state (the parent already
// resets it on global "close all modals", which is why it stays up
// top), shared purchaseOptions, and ids/flags.
//
// Extracted from Subscription.tsx — ~170 lines off the god page.
// ──────────────────────────────────────────────────────────────────

export interface TrafficTopupSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  subscription: Subscription;
  subscriptionId: number | undefined;
  selectedTrafficPackage: number | null;
  onSelectedTrafficPackageChange: (gb: number | null) => void;
  purchaseOptions: PurchaseOptions | undefined;
  isDark: boolean;
}

export function TrafficTopupSheet({
  open,
  onOpen,
  onClose,
  subscription,
  subscriptionId,
  selectedTrafficPackage,
  onSelectedTrafficPackageChange,
  purchaseOptions,
}: TrafficTopupSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Общий формат суммы, как на соседних экранах: «1 490,50 ₽», а не «1490.50 ₽»;
  // знак валюты приклеен неразрывным пробелом.
  const { formatMoney } = useCurrency();
  const formatPrice = (kopeks: number) => formatMoney(kopeks / 100);

  const { data: trafficPackages } = useQuery({
    queryKey: ['traffic-packages', subscriptionId],
    queryFn: () => subscriptionApi.getTrafficPackages(subscriptionId),
    enabled: open && !!subscription,
  });

  const purchaseMutation = useMutation({
    retry: false,
    mutationFn: (gb: number) => subscriptionApi.purchaseTraffic(gb, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['traffic-packages', subscriptionId] });
      onClose();
      onSelectedTrafficPackageChange(null);
    },
  });

  const close = () => {
    onClose();
    onSelectedTrafficPackageChange(null);
  };
  const selectedPkg =
    selectedTrafficPackage !== null
      ? trafficPackages?.find((p) => p.gb === selectedTrafficPackage)
      : undefined;
  const hasEnoughBalance =
    !selectedPkg || !purchaseOptions || selectedPkg.price_kopeks <= purchaseOptions.balance_kopeks;
  const missingAmount =
    selectedPkg && purchaseOptions ? selectedPkg.price_kopeks - purchaseOptions.balance_kopeks : 0;

  return (
    <>
      <Row
        icon={<PiChartPieSliceDuotone />}
        label={t('subscription.additionalOptions.buyTraffic')}
        description={t('subscription.additionalOptions.currentTrafficLimit', {
          limit: formatGbShort(subscription.traffic_limit_gb ?? 0),
          used: formatGbShort(subscription.traffic_used_gb ?? 0),
        })}
        onClick={onOpen}
      />
      <ResponsiveSheet
        isOpen={open}
        onClose={close}
        title={t('subscription.additionalOptions.buyTrafficTitle')}
      >
        <SheetBody>
          <SheetNote>{t('subscription.additionalOptions.trafficWarning')}</SheetNote>

          {!trafficPackages || trafficPackages.length === 0 ? (
            <SheetNote>{t('subscription.additionalOptions.trafficUnavailable')}</SheetNote>
          ) : (
            <>
              <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-800/40">
                {trafficPackages.map((pkg) => {
                  const selected = selectedTrafficPackage === pkg.gb;
                  const discounted = pkg.discount_percent != null && pkg.discount_percent > 0;
                  return (
                    <button
                      key={pkg.gb}
                      type="button"
                      onClick={() => onSelectedTrafficPackageChange(pkg.gb)}
                      aria-pressed={selected}
                      className={cn(
                        'flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        selected ? 'bg-accent-500/10' : 'hover:bg-dark-800/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                          selected ? 'bg-accent-500' : 'bg-dark-700',
                        )}
                        aria-hidden
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] font-semibold text-dark-100">
                        {pkg.is_unlimited
                          ? t('subscription.additionalOptions.unlimited')
                          : `${pkg.gb} ${t('common.units.gb')}`}
                      </span>
                      {discounted && <Chip tone="success">-{pkg.discount_percent}%</Chip>}
                      <span className="flex flex-col items-end">
                        <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-dark-50">
                          {formatPrice(pkg.price_kopeks)}
                        </span>
                        {discounted && pkg.base_price_kopeks ? (
                          <span className="whitespace-nowrap text-[13px] text-dark-500 line-through">
                            {formatPrice(pkg.base_price_kopeks)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedTrafficPackage !== null && !hasEnoughBalance && missingAmount > 0 && (
                <InsufficientBalancePrompt
                  missingAmountKopeks={missingAmount}
                  compact
                  onBeforeTopUp={async () => {
                    await subscriptionApi.saveTrafficCart(selectedTrafficPackage, subscriptionId);
                  }}
                />
              )}

              <Button
                className="w-full"
                onClick={() =>
                  selectedTrafficPackage !== null && purchaseMutation.mutate(selectedTrafficPackage)
                }
                disabled={
                  selectedTrafficPackage === null || purchaseMutation.isPending || !hasEnoughBalance
                }
              >
                {purchaseMutation.isPending ? (
                  <Spinner />
                ) : selectedTrafficPackage === null ? (
                  t('subscription.v10.pickPackage', 'Выберите пакет')
                ) : selectedPkg?.is_unlimited ? (
                  t('subscription.additionalOptions.buyUnlimited')
                ) : (
                  t('subscription.additionalOptions.buyTrafficGb', { gb: selectedTrafficPackage })
                )}
              </Button>

              {purchaseMutation.isError && (
                <p className="text-center text-[13px] text-error-400">
                  {isUncertainPurchaseOutcome(purchaseMutation.error)
                    ? t('subscription.purchaseOutcomeUnknown')
                    : getErrorMessage(purchaseMutation.error)}
                </p>
              )}
            </>
          )}
        </SheetBody>
      </ResponsiveSheet>
    </>
  );
}
