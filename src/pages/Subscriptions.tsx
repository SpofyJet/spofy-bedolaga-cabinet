import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PiStackDuotone } from 'react-icons/pi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Page } from '@/components/spofy/ui';
import { subscriptionApi } from '../api/subscription';
import { useAuthStore } from '../store/auth';
import { getApiErrorMessage } from '../utils/api-error';
import TrialOfferCard from '../components/dashboard/TrialOfferCard';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export default function Subscriptions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { search } = useLocation();
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [trialError, setTrialError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const subscriptions = data?.subscriptions ?? [];
  const hasNoSubscriptions = !isLoading && subscriptions.length === 0;

  // Если у юзера нет подписок — проверяем доступность триала.
  const { data: trialInfo, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: hasNoSubscriptions,
    staleTime: 30_000,
  });

  const activateTrialMutation = useMutation({
    mutationFn: () => subscriptionApi.activateTrial(),
    onSuccess: () => {
      setTrialError(null);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['trial-info'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      refreshUser();
    },
    onError: (error: unknown) => {
      setTrialError(getApiErrorMessage(error, t('common.error')));
    },
  });

  // Подписка одна (у бота нет мультитарифа): списка нет — сразу её экран.
  // Ссылка /subscriptions живёт ради нижней панели, закладок и старых ссылок.
  if (data && subscriptions.length > 0) {
    return <Navigate to={`/subscriptions/${subscriptions[0].id}${search}`} replace />;
  }

  return (
    <Page>
      <PageHeader title={t('subscriptions.title', 'Мои подписки')} backTo="/" />

      {isLoading && (
        <SkeletonGroup className="space-y-4">
          <Skeleton variant="card" count={2} className="h-36 rounded-3xl" />
        </SkeletonGroup>
      )}

      {/* Empty state: показываем триал, если доступен; иначе — обычный empty */}
      {hasNoSubscriptions && !trialLoading && trialInfo?.is_available && (
        <div className="space-y-4">
          <TrialOfferCard
            trialInfo={trialInfo}
            activateTrialMutation={activateTrialMutation}
            trialError={trialError}
          />
          {/* Новый пользователь не обязан активировать триал, чтобы попасть
              в витрину — даём явный путь к покупке подписки (Telegram-баг
              #605056/#605063). */}
          <Button
            tone="secondary"
            className="w-full"
            onClick={() => navigate('/subscription/purchase')}
          >
            {t('subscriptions.browsePlans', 'Тарифы и цены')}
          </Button>
        </div>
      )}
      {hasNoSubscriptions && !trialLoading && !trialInfo?.is_available && (
        <EmptyState
          icon={<PiStackDuotone />}
          title={t('subscriptions.empty', 'Нет подписок')}
          text={t('subscriptions.emptyDesc', 'У вас пока нет активных подписок')}
          action={
            <Button onClick={() => navigate('/subscription/purchase')}>
              {t('subscriptions.buy', 'Купить подписку')}
            </Button>
          }
        />
      )}
    </Page>
  );
}
