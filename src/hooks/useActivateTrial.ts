import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { subscriptionApi } from '../api/subscription';
import { useAuthStore } from '../store/auth';
import { getApiErrorMessage } from '../utils/api-error';

const REFRESH_AFTER_TRIAL = [
  'subscription',
  'subscriptions-list',
  'trial-info',
  'balance',
  'purchase-options',
];

/**
 * Активация пробной подписки — главная и «Подписки».
 * onSuccess возвращает перезапрос: пока подписка и пробный не перечитаны, мутация
 * остаётся в ожидании и кнопка заблокирована. Иначе карточка пробного ещё видна
 * с активной кнопкой, и второе нажатие шлёт второй POST /subscription/trial.
 */
export function useActivateTrial() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [trialError, setTrialError] = useState<string | null>(null);

  const activateTrialMutation = useMutation({
    mutationFn: () => subscriptionApi.activateTrial(),
    onSuccess: () => {
      setTrialError(null);
      const refetched = Promise.all(
        REFRESH_AFTER_TRIAL.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      refreshUser();
      return refetched;
    },
    onError: (error: unknown) => {
      setTrialError(getApiErrorMessage(error, t('common.error')));
    },
  });

  return { activateTrialMutation, trialError };
}
