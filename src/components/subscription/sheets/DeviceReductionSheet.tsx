import { useEffect } from 'react';
import { deviceUnavailableText } from '../deviceReasons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage } from '../../../utils/subscriptionHelpers';
import { PiMinusCircleDuotone } from 'react-icons/pi';
import { Button, Row } from '@/components/spofy/ui';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { SheetBody, SheetNote, Spinner, Stepper } from './sheetParts';

// ──────────────────────────────────────────────────────────────────
// Reduce-devices sheet. Self-owns the reduction-info query + mutation;
// parent passes shared state (target limit + setter + ids + open flag).
//
// Extracted from Subscription.tsx to keep one cohesive feature in
// one file (~170 lines off the god page).
// ──────────────────────────────────────────────────────────────────

export interface DeviceReductionSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  subscriptionPresent: boolean;
  subscriptionId: number | undefined;
  targetDeviceLimit: number;
  onTargetDeviceLimitChange: (n: number) => void;
  isDark: boolean;
  /**
   * Как выглядит вход: строка группы (по умолчанию) или тихая ссылка под
   * списком устройств — уменьшение лимита нужно редко и не должно стоять в
   * одном ряду с покупками.
   */
  trigger?: 'row' | 'link';
}

export function DeviceReductionSheet({
  open,
  onOpen,
  onClose,
  subscriptionPresent,
  subscriptionId,
  targetDeviceLimit,
  onTargetDeviceLimitChange,
  trigger = 'row',
}: DeviceReductionSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: deviceReductionInfo } = useQuery({
    queryKey: ['device-reduction-info', subscriptionId],
    queryFn: () => subscriptionApi.getDeviceReductionInfo(subscriptionId),
    enabled: open && subscriptionPresent,
  });

  // Seed the target limit once the info comes back.
  // biome-ignore lint/correctness/useExhaustiveDependencies: сеттер родителя стабилен, повторно заполнять значение нельзя
  useEffect(() => {
    if (deviceReductionInfo && open) {
      onTargetDeviceLimitChange(
        Math.max(
          deviceReductionInfo.min_device_limit,
          deviceReductionInfo.current_device_limit - 1,
        ),
      );
    }
    // onTargetDeviceLimitChange is a setter from the parent and stable
    // enough; intentionally narrow deps to avoid clobbering user input.
  }, [deviceReductionInfo, open]);

  const reduceMutation = useMutation({
    mutationFn: () => subscriptionApi.reduceDevices(targetDeviceLimit, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['device-reduction-info', subscriptionId] });
      onClose();
    },
  });

  const floor = deviceReductionInfo
    ? Math.max(deviceReductionInfo.min_device_limit, deviceReductionInfo.connected_devices_count)
    : 1;

  return (
    <>
      {trigger === 'link' ? (
        <button
          type="button"
          onClick={onOpen}
          className="mx-auto mt-2 flex items-center gap-1.5 rounded-xl px-3 min-h-[44px] py-2 text-[13px] font-medium text-dark-400 transition-colors hover:bg-dark-800/40 hover:text-dark-200"
        >
          <PiMinusCircleDuotone className="h-4 w-4" aria-hidden />
          {t('subscription.additionalOptions.reduceDevices')}
        </button>
      ) : (
        <Row
          icon={<PiMinusCircleDuotone />}
          label={t('subscription.additionalOptions.reduceDevices')}
          description={t('subscription.additionalOptions.reduceDevicesDescription')}
          onClick={onOpen}
        />
      )}
      <ResponsiveSheet
        isOpen={open}
        onClose={onClose}
        title={t('subscription.additionalOptions.reduceDevicesTitle')}
      >
        <SheetBody>
          {deviceReductionInfo?.available === false ? (
            <SheetNote>
              {deviceUnavailableText(
                t,
                deviceReductionInfo,
                'subscription.additionalOptions.reduceUnavailable',
              )}
            </SheetNote>
          ) : deviceReductionInfo ? (
            <>
              <Stepper
                value={targetDeviceLimit}
                unit={t('subscription.additionalOptions.devicesUnit')}
                onDecrement={() =>
                  onTargetDeviceLimitChange(Math.max(floor, targetDeviceLimit - 1))
                }
                onIncrement={() =>
                  onTargetDeviceLimitChange(
                    Math.min(deviceReductionInfo.current_device_limit - 1, targetDeviceLimit + 1),
                  )
                }
                decrementDisabled={targetDeviceLimit <= floor}
                incrementDisabled={
                  targetDeviceLimit >= deviceReductionInfo.current_device_limit - 1
                }
                decrementLabel={t('subscription.additionalOptions.decrementDevices', 'Уменьшить')}
                incrementLabel={t('subscription.additionalOptions.incrementDevices', 'Увеличить')}
              />

              <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-800/40 text-[14px]">
                {[
                  t('subscription.additionalOptions.currentDeviceLimit', {
                    count: deviceReductionInfo.current_device_limit,
                  }),
                  t('subscription.additionalOptions.minDeviceLimit', {
                    count: deviceReductionInfo.min_device_limit,
                  }),
                  t('subscription.additionalOptions.connectedDevices', {
                    count: deviceReductionInfo.connected_devices_count,
                  }),
                ].map((line) => (
                  <p key={line} className="px-4 py-2.5 text-dark-300">
                    {line}
                  </p>
                ))}
              </div>

              {deviceReductionInfo.connected_devices_count >
                deviceReductionInfo.min_device_limit && (
                <SheetNote tone="warning">
                  {t('subscription.additionalOptions.disconnectDevicesFirst', {
                    count: deviceReductionInfo.connected_devices_count,
                  })}
                </SheetNote>
              )}

              <p className="text-center text-[13px] text-dark-400">
                {t('subscription.additionalOptions.newDeviceLimit', { count: targetDeviceLimit })}
              </p>

              <Button
                className="w-full"
                onClick={() => reduceMutation.mutate()}
                disabled={
                  reduceMutation.isPending ||
                  targetDeviceLimit >= deviceReductionInfo.current_device_limit ||
                  targetDeviceLimit < deviceReductionInfo.min_device_limit ||
                  targetDeviceLimit < deviceReductionInfo.connected_devices_count
                }
              >
                {reduceMutation.isPending ? (
                  <>
                    <Spinner />
                    {t('subscription.additionalOptions.reducing')}
                  </>
                ) : (
                  t('subscription.additionalOptions.reduce')
                )}
              </Button>

              {reduceMutation.isError && (
                <p className="text-center text-[13px] text-error-400">
                  {getErrorMessage(reduceMutation.error)}
                </p>
              )}
            </>
          ) : (
            <div className="flex justify-center py-6 text-accent-400">
              <Spinner />
            </div>
          )}
        </SheetBody>
      </ResponsiveSheet>
    </>
  );
}
