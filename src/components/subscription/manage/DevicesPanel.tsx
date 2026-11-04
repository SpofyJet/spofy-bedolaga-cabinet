import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import { PiCheckBold, PiPencilSimpleBold, PiTrashBold, PiXBold } from 'react-icons/pi';
import { RowIcon, SectionTitle } from '@/components/spofy/ui';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { DEVICE_ALIAS_MAX_LENGTH } from '@/constants/devices';
import { useHaptic } from '@/platform';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import type { Subscription } from '@/types';
import { platformIcon } from '@/components/subscription/platformIcon';

export interface DevicesPanelProps {
  subscription: Subscription;
  subscriptionId: number | undefined;
  /** Под списком: редкие действия с лимитом устройств (уменьшить). */
  footer?: ReactNode;
}

/**
 * Список подключённых устройств: переименование, удаление по одному и все сразу.
 *
 * Вынесен из тела страницы подписки, чтобы им мог пользоваться простой вид.
 * Запрос устройств живёт здесь же и делит ключ ['devices', id] с остальными
 * экранами, так что показ списка не стоит лишнего похода в сеть.
 *
 * Одновременно редактируется одно устройство: `editingDeviceHwid` служит и
 * переключателем, и признаком того, какая строка сейчас правится.
 */
export function DevicesPanel({ subscription, subscriptionId, footer }: DevicesPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const destructiveConfirm = useDestructiveConfirm();

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
    enabled: Boolean(subscription),
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (hwid: string) => subscriptionApi.deleteDevice(hwid, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  const deleteAllDevicesMutation = useMutation({
    mutationFn: () => subscriptionApi.deleteAllDevices(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  const [editingDeviceHwid, setEditingDeviceHwid] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  const renameDeviceMutation = useMutation({
    mutationFn: ({ hwid, name }: { hwid: string; name: string | null }) =>
      subscriptionApi.renameDevice(hwid, name, subscriptionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      // Soft success-tap, like other mutations on this page.
      haptic.notification('success');
      // Не сбрасываем edit-state, если пользователь уже перешёл на другой
      // девайс пока шёл запрос — иначе теряем его новый input. Имя не чистим
      // безусловно: оно либо принадлежит уже другому девайсу (нужно сохранить),
      // либо инпут уже закрылся (значение не отображается).
      setEditingDeviceHwid((current) => (current === variables.hwid ? null : current));
    },
    onError: () => {
      haptic.notification('error');
    },
  });

  return (
    <section id="sp-devices" className="scroll-mt-4">
      <SectionTitle
        right={
          devicesData && devicesData.devices.length > 0 ? (
            <button
              type="button"
              onClick={async () => {
                // Platform-aware destructive confirm: Telegram native popup
                // in Mini App, inline panel on web.
                const confirmed = await destructiveConfirm(
                  t('subscription.confirmDeleteAllDevices'),
                  t('subscription.deleteAllDevices'),
                  t('subscription.deleteAllDevices'),
                );
                if (confirmed) deleteAllDevicesMutation.mutate();
              }}
              disabled={deleteAllDevicesMutation.isPending}
              className="text-[13px] font-medium text-error-400 transition-colors hover:text-error-300 disabled:opacity-50"
            >
              {t('subscription.deleteAllDevices')}
            </button>
          ) : undefined
        }
      >
        {t('subscription.myDevices')}
      </SectionTitle>

      {devicesLoading ? (
        <SkeletonGroup className="space-y-2">
          <Skeleton variant="card" count={2} className="h-[60px] rounded-3xl" />
        </SkeletonGroup>
      ) : devicesData && devicesData.devices.length > 0 ? (
        <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-900/70 ring-1 ring-inset ring-dark-800/80">
          {devicesData.devices.map((device) => {
            const isEditing = editingDeviceHwid === device.hwid;
            // Display priority: user alias → device model → platform.
            const displayName = device.local_name?.trim() || device.device_model || device.platform;
            const save = () => {
              const trimmed = editingDeviceName.trim();
              renameDeviceMutation.mutate({ hwid: device.hwid, name: trimmed || null });
            };
            const PlatformIcon = platformIcon(device.platform, 'duotone');
            const iconBtn =
              'flex h-9 w-9 items-center justify-center rounded-xl text-dark-400 transition-colors hover:bg-dark-800/70 hover:text-dark-100 disabled:opacity-50';

            return (
              <div key={device.hwid} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
                <RowIcon tone="muted">
                  <PlatformIcon />
                </RowIcon>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingDeviceName}
                      maxLength={DEVICE_ALIAS_MAX_LENGTH}
                      placeholder={device.device_model || device.platform}
                      onChange={(e) => setEditingDeviceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          save();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingDeviceHwid(null);
                          setEditingDeviceName('');
                        }
                      }}
                      className="w-full rounded-xl bg-dark-800 px-3 py-1.5 text-[15px] font-semibold text-dark-50 outline-none ring-1 ring-inset ring-dark-700 focus:ring-accent-500"
                    />
                  ) : (
                    <div className="truncate text-[15px] font-semibold text-dark-100">
                      {displayName}
                    </div>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-dark-400">
                    <span className="truncate">{device.platform}</span>
                    <span className="min-w-0 select-all break-all text-dark-500">
                      {device.hwid}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={save}
                        disabled={renameDeviceMutation.isPending}
                        className={iconBtn}
                        title={t('subscription.renameDeviceSave', 'Сохранить')}
                        aria-label={t('subscription.renameDeviceSave', 'Сохранить')}
                      >
                        <PiCheckBold className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDeviceHwid(null);
                          setEditingDeviceName('');
                        }}
                        disabled={renameDeviceMutation.isPending}
                        className={iconBtn}
                        title={t('subscription.renameDeviceCancel', 'Отмена')}
                        aria-label={t('subscription.renameDeviceCancel', 'Отмена')}
                      >
                        <PiXBold className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDeviceHwid(device.hwid);
                          setEditingDeviceName(device.local_name || '');
                        }}
                        className={iconBtn}
                        title={t('subscription.renameDevice', 'Переименовать')}
                        aria-label={t('subscription.renameDevice', 'Переименовать')}
                      >
                        <PiPencilSimpleBold className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await destructiveConfirm(
                            t('subscription.confirmDeleteDevice'),
                            t('subscription.deleteDevice'),
                            t('subscription.deleteDevice'),
                          );
                          if (confirmed) deleteDeviceMutation.mutate(device.hwid);
                        }}
                        disabled={deleteDeviceMutation.isPending}
                        className={iconBtn}
                        title={t('subscription.deleteDevice')}
                        aria-label={t('subscription.deleteDevice')}
                      >
                        <PiTrashBold className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl bg-dark-900/70 px-4 py-6 text-center text-[13px] text-dark-400 ring-1 ring-inset ring-dark-800/80">
          {t('subscription.noDevices')}
        </div>
      )}
      {footer}
    </section>
  );
}

export default DevicesPanel;
