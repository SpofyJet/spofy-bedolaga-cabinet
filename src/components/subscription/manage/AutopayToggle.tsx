import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import type { Subscription } from '@/types';
import { showsAutopayToggle } from '@/utils/legacySubscription';
import { PiArrowsClockwiseDuotone } from 'react-icons/pi';
import { RowIcon } from '@/components/spofy/ui';

export interface AutopayToggleProps {
  subscription: Subscription;
  subscriptionId: number | undefined;
  /** Устарело: тумблер берёт цвета из токенов темы. Оставлено для совместимости. */
  accentColor?: string;
  /** Устарело, см. accentColor. */
  offColor?: string;
  /** Устарело: строка рисуется без своей подложки, фон даёт группа. */
  surface?: { background: string; border: string };
}

/**
 * Тумблер автоплатежа с баланса — строкой группы (как в профиле).
 *
 * Вынесен из тела страницы подписки, чтобы тем же тумблером мог пользоваться
 * простой вид. Мутация живёт здесь: она инвалидирует ещё и состояние
 * СБП-автоплатежа — включение списания с баланса отменяет его на стороне
 * сервера, и без этого сброса блок СБП продолжал бы показывать протухшее
 * «активен».
 *
 * Возвращает null, когда тумблер неуместен (пробные, суточные, старые и
 * вечные подписки) — решение принимает общий помощник, а не вызывающий экран.
 */
export function AutopayToggle({ subscription, subscriptionId }: AutopayToggleProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const autopayMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      subscriptionApi.updateAutopay(enabled, undefined, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      // Enabling balance-autopay cancels SBP auto-pay server-side — refresh so
      // the SBP block doesn't keep showing a now-stale 'active'/'pending' state.
      queryClient.invalidateQueries({ queryKey: ['sbp-recurring', subscriptionId] });
    },
  });

  if (!showsAutopayToggle(subscription)) return null;

  const on = subscription.autopay_enabled;

  return (
    <div className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5">
      <RowIcon tone="plan">
        <PiArrowsClockwiseDuotone />
      </RowIcon>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-dark-100">
          {t('subscription.autoRenewal')}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-dark-400">
          {t('subscription.v10.autopayHint', 'С баланса за {{count}} дн. до конца срока', {
            count: subscription.autopay_days_before,
          })}
        </span>
      </span>
      <button
        type="button"
        onClick={() => autopayMutation.mutate(!on)}
        disabled={autopayMutation.isPending}
        role="switch"
        aria-checked={on}
        aria-label={t('subscription.autopay', 'Auto-payment')}
        className={`relative h-7 w-12 shrink-0 rounded-full before:absolute before:-inset-2 before:content-[''] transition-colors duration-200 disabled:opacity-60 ${
          on ? 'bg-accent-500' : 'bg-dark-700'
        }`}
      >
        <span
          className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

export default AutopayToggle;
