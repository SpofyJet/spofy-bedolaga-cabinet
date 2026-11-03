import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiTrashDuotone } from 'react-icons/pi';
import { Button, Surface } from '@/components/spofy/ui';
import { subscriptionApi } from '../../../api/subscription';
import { usePlatform } from '../../../platform';
import { useDestructiveConfirm } from '../../../platform/hooks/useNativeDialog';

// ──────────────────────────────────────────────────────────────────
// Delete-subscription sheet. Telegram path goes through the native
// destructive dialog and skips the inline expand; the web path expands
// an inline confirm panel with two buttons.
//
// Self-owns deleteLoading; parent only supplies the id, theme colour
// hints, open-state, and the onDeleted callback (used for navigate +
// invalidate after the API resolves).
// ──────────────────────────────────────────────────────────────────

export interface DeleteSubscriptionSheetProps {
  subscriptionId: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDeleted: () => void;
  /** color/background tokens already resolved from glassTheme */
  textSecondary: string;
}

export function DeleteSubscriptionSheet({
  subscriptionId,
  open,
  onOpen,
  onClose,
  onDeleted,
  textSecondary,
}: DeleteSubscriptionSheetProps) {
  const { t } = useTranslation();
  const { platform } = usePlatform();
  const destructiveConfirm = useDestructiveConfirm();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const performDelete = async () => {
    setDeleteLoading(true);
    try {
      await subscriptionApi.deleteSubscription(subscriptionId);
      onDeleted();
    } catch {
      setDeleteLoading(false);
      onClose();
    }
  };

  const handleTriggerClick = async () => {
    if (platform === 'telegram') {
      const confirmed = await destructiveConfirm(
        t(
          'subscription.deleteWarning',
          'Подписка будет удалена безвозвратно. Все данные, устройства и настройки будут потеряны.',
        ),
        t('subscription.confirmDelete', 'Да, удалить'),
        t('subscription.deleteTitle', 'Удалить подписку?'),
      );
      if (!confirmed) return;
      await performDelete();
    } else {
      onOpen();
    }
  };

  if (!open) {
    return (
      <Button
        tone="danger"
        className="w-full"
        onClick={handleTriggerClick}
        disabled={deleteLoading}
      >
        <PiTrashDuotone className="h-5 w-5" />
        {t('subscription.delete', 'Удалить подписку')}
      </Button>
    );
  }

  return (
    <Surface className="space-y-4">
      <div>
        <p className="text-[15px] font-semibold text-error-400">
          {t('subscription.deleteTitle', 'Удалить подписку?')}
        </p>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: textSecondary }}>
          {t(
            'subscription.deleteWarning',
            'Подписка будет удалена безвозвратно. Все данные, устройства и настройки будут потеряны. Это действие нельзя отменить.',
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button tone="danger" onClick={performDelete} disabled={deleteLoading}>
          {deleteLoading
            ? t('common.processing', 'Удаление...')
            : t('subscription.confirmDelete', 'Да, удалить')}
        </Button>
        <Button tone="secondary" onClick={onClose}>
          {t('common.cancel', 'Отмена')}
        </Button>
      </div>
    </Surface>
  );
}
