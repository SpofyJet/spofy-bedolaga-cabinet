import { create } from 'zustand';

export interface ConfirmOptions {
  message: string;
  title?: string;
  /** Подпись кнопки действия. */
  actionLabel?: string;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  /** Открывает лист подтверждения; обещание вернёт true, если действие подтвердили. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
}

/**
 * Подтверждение разрушительного действия вне Telegram: свой лист вместо
 * системного window.confirm. Рисует его ConfirmSheetHost в оболочке кабинета.
 */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,

  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      // Открытый запрос отменяем: два листа подряд не показываем.
      get().request?.resolve(false);
      set({ request: { ...options, resolve } });
    }),

  settle: (confirmed) => {
    const request = get().request;
    if (!request) return;
    request.resolve(confirmed);
    set({ request: null });
  },
}));
