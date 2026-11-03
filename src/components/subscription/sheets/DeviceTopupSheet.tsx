import { isLifetimePeriod } from '@/utils/lifetime';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../hooks/useCurrency';
import { deviceUnavailableText } from '../deviceReasons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage } from '../../../utils/subscriptionHelpers';
import InsufficientBalancePrompt from '../../InsufficientBalancePrompt';
import { PiPlusCircleDuotone } from 'react-icons/pi';
import { Button, Chip, Row } from '@/components/spofy/ui';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { SheetBody, SheetNote, Spinner, Stepper, TotalLine } from './sheetParts';
import type { PurchaseOptions, Subscription } from '../../../types';

// ──────────────────────────────────────────────────────────────────
// Buy-devices sheet. Self-owns its devicePrice query + purchase mutation;
// parent only passes the subscription / id / open state and the shared
// purchaseOptions (which it already holds for sibling sheets and balance
// gating).
//
// Extracted from Subscription.tsx to drop ~190 lines from the god page.
// ──────────────────────────────────────────────────────────────────

export interface DeviceTopupSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  subscription: Subscription;
  subscriptionId: number | undefined;
  devicesToAdd: number;
  onDevicesToAddChange: (n: number) => void;
  purchaseOptions: PurchaseOptions | undefined;
  isDark: boolean;
}

export function DeviceTopupSheet({
  open,
  onOpen,
  onClose,
  subscription,
  subscriptionId,
  devicesToAdd,
  onDevicesToAddChange,
  purchaseOptions,
}: DeviceTopupSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Общий формат суммы, как на соседних экранах: «1 490,50 ₽», а не «1490.50 ₽»;
  // знак валюты приклеен неразрывным пробелом.
  const { formatAmount, currencySymbol } = useCurrency();
  const formatPrice = (kopeks: number) => {
    const rubles = kopeks / 100;
    return `${formatAmount(rubles, rubles % 1 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;
  };

  const { data: devicePriceData } = useQuery({
    queryKey: ['device-price', devicesToAdd, subscriptionId],
    queryFn: () => subscriptionApi.getDevicePrice(devicesToAdd, subscriptionId),
    enabled: open && !!subscription,
  });

  const devicePurchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.purchaseDevices(devicesToAdd, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['device-price'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      onClose();
      onDevicesToAddChange(1);
    },
  });

  const insufficient = !!(
    devicePriceData?.available &&
    purchaseOptions &&
    devicePriceData.total_price_kopeks &&
    devicePriceData.total_price_kopeks > purchaseOptions.balance_kopeks
  );
  const hasDiscount =
    devicePriceData?.discount_percent != null && devicePriceData.discount_percent > 0;

  return (
    <>
      <Row
        icon={<PiPlusCircleDuotone />}
        label={t('subscription.additionalOptions.buyDevices')}
        description={t('subscription.additionalOptions.currentDeviceLimit', {
          count: subscription.device_limit,
        })}
        onClick={onOpen}
      />
      <ResponsiveSheet isOpen={open} onClose={onClose} title={t('subscription.buyDevices')}>
        <SheetBody>
          {devicePriceData?.available === false ? (
            <SheetNote>
              {deviceUnavailableText(
                t,
                devicePriceData,
                'subscription.additionalOptions.devicesUnavailable',
              )}
            </SheetNote>
          ) : (
            <>
              <Stepper
                value={devicesToAdd}
                unit={t('subscription.additionalOptions.devicesUnit')}
                onDecrement={() => onDevicesToAddChange(Math.max(1, devicesToAdd - 1))}
                onIncrement={() => onDevicesToAddChange(devicesToAdd + 1)}
                decrementDisabled={devicesToAdd <= 1}
                incrementDisabled={
                  devicePriceData?.max_device_limit
                    ? (devicePriceData.current_device_limit || 0) + devicesToAdd >=
                      devicePriceData.max_device_limit
                    : false
                }
                decrementLabel={t('subscription.additionalOptions.decrementDevices', 'Уменьшить')}
                incrementLabel={t('subscription.additionalOptions.incrementDevices', 'Увеличить')}
              />

              {devicePriceData?.max_device_limit && (
                <p className="text-center text-[13px] text-dark-400">
                  {t('subscription.additionalOptions.currentDeviceLimit', {
                    count: devicePriceData.current_device_limit || subscription.device_limit,
                  })}{' '}
                  ·{' '}
                  {t('subscription.additionalOptions.maxDevices', {
                    count: devicePriceData.max_device_limit,
                  })}
                </p>
              )}

              {devicePriceData?.available && devicePriceData.price_per_device_label && (
                <div className="space-y-2 rounded-3xl bg-dark-800/40 p-4 ring-1 ring-inset ring-dark-800/80">
                  <div className="flex items-center justify-between gap-3 px-1 text-[13px] text-dark-400">
                    <span>
                      {hasDiscount && devicePriceData.original_price_per_device_kopeks ? (
                        <>
                          <span className="text-dark-500 line-through">
                            {formatPrice(devicePriceData.original_price_per_device_kopeks)}
                          </span>{' '}
                        </>
                      ) : null}
                      {devicePriceData.price_per_device_label}
                      {t('subscription.perDevice').replace('/ ', ' / ')}
                    </span>
                    <span>
                      {isLifetimePeriod(devicePriceData.days_left)
                        ? t('subscription.lifetime.forever')
                        : t('subscription.days', { count: devicePriceData.days_left })}
                    </span>
                  </div>
                  <TotalLine
                    label={
                      <span className="flex items-center gap-2">
                        {t('subscription.total')}
                        {hasDiscount && (
                          <Chip tone="success">-{devicePriceData.discount_percent}%</Chip>
                        )}
                      </span>
                    }
                  >
                    {devicePriceData.total_price_kopeks === 0 ? (
                      <span className="text-success-400">
                        {t('subscription.switchTariff.free')}
                      </span>
                    ) : (
                      <>
                        {hasDiscount && devicePriceData.base_total_price_kopeks && (
                          <span className="mr-2 text-sm font-medium text-dark-500 line-through">
                            {formatPrice(devicePriceData.base_total_price_kopeks)}
                          </span>
                        )}
                        {devicePriceData.total_price_label}
                      </>
                    )}
                  </TotalLine>
                </div>
              )}

              {insufficient && purchaseOptions && devicePriceData?.total_price_kopeks && (
                <InsufficientBalancePrompt
                  missingAmountKopeks={
                    devicePriceData.total_price_kopeks - purchaseOptions.balance_kopeks
                  }
                  compact
                  onBeforeTopUp={async () => {
                    await subscriptionApi.saveDevicesCart(devicesToAdd, subscriptionId);
                  }}
                />
              )}

              <Button
                className="w-full"
                onClick={() => devicePurchaseMutation.mutate()}
                disabled={
                  devicePurchaseMutation.isPending || !devicePriceData?.available || insufficient
                }
              >
                {devicePurchaseMutation.isPending ? (
                  <Spinner />
                ) : (
                  t('subscription.additionalOptions.buy')
                )}
              </Button>

              {devicePurchaseMutation.isError && (
                <p className="text-center text-[13px] text-error-400">
                  {getErrorMessage(devicePurchaseMutation.error)}
                </p>
              )}
            </>
          )}
        </SheetBody>
      </ResponsiveSheet>
    </>
  );
}
