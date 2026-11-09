import { useTranslation } from 'react-i18next';

import { Button } from '@/components/spofy/ui';
import { SheetBody } from '@/components/subscription/sheets/sheetParts';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { useConfirmStore } from '@/store/confirmDialog';

/**
 * Лист подтверждения разрушительного действия (перевыпуск ссылки, удаление
 * устройств). Один на всё приложение, открывается через useDestructiveConfirm.
 */
export function ConfirmSheetHost() {
  const { t } = useTranslation();
  const request = useConfirmStore((s) => s.request);
  const settle = useConfirmStore((s) => s.settle);

  return (
    <ResponsiveSheet
      isOpen={request !== null}
      onClose={() => settle(false)}
      title={request?.title ?? t('common.confirm')}
    >
      <SheetBody>
        <p className="text-[15px] leading-snug text-dark-200">{request?.message}</p>
        <div className="space-y-2">
          <Button tone="danger" className="w-full" onClick={() => settle(true)}>
            {request?.actionLabel ?? t('common.confirm')}
          </Button>
          <Button tone="secondary" className="w-full" onClick={() => settle(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </SheetBody>
    </ResponsiveSheet>
  );
}
