import { useState } from 'react';
import { hasLegacySubscription } from '../utils/legacySubscription';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PiPlusBold, PiStackDuotone } from 'react-icons/pi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Page } from '@/components/spofy/ui';
import { subscriptionApi } from '../api/subscription';
import { balanceApi } from '../api/balance';
import { useAuthStore } from '../store/auth';
import { getApiErrorMessage } from '../utils/api-error';
import SubscriptionListCard from '../components/subscription/SubscriptionListCard';
import TrialOfferCard from '../components/dashboard/TrialOfferCard';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export default function Subscriptions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const isMultiTariff = data?.multi_tariff_enabled ?? false;
  const hasNoSubscriptions = !isLoading && subscriptions.length === 0;
  // Активный триал — тоже работающий доступ: покупку сохраняем, но не делаем
  // её заметнее подключения. Для истёкших подписок покупка остаётся основной.
  const hasActiveAccess = subscriptions.some(
    (s) => s.status === 'active' || s.status === 'limited',
  );
  // Старая подписка (без тарифа при включённых тарифах) в списке: «купить ещё»
  // не предлагаем, её карточка ведёт на переход на тариф.
  const hasLegacy = hasLegacySubscription(subscriptions);

  // Если у юзера нет подписок — проверяем доступность триала, иначе
  // (в multi-tariff) ему вообще негде увидеть оффер.
  const { data: trialInfo, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: hasNoSubscriptions,
    staleTime: 30_000,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    enabled: hasNoSubscriptions && !!trialInfo?.is_available,
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

  // Single-tariff mode with one subscription: skip list, go directly to detail
  if (data && !isMultiTariff && subscriptions.length === 1) {
    return <Navigate to={`/subscriptions/${subscriptions[0].id}`} replace />;
  }

  return (
    <Page>
      <PageHeader
        title={t('subscriptions.title', 'Мои подписки')}
        backTo="/"
        right={
          // При живом доступе покупка остаётся компактным второстепенным действием.
          !isLoading && !hasLegacy && hasActiveAccess ? (
            <Button
              tone="secondary"
              className="h-10 px-3.5 text-sm"
              onClick={() => navigate('/subscription/purchase')}
            >
              <PiPlusBold className="h-4 w-4" />
              {t('subscriptions.buyAnother', 'Новый тариф')}
            </Button>
          ) : undefined
        }
      />

      {/* Живого доступа нет: покупка или продление остаётся явным следующим шагом. */}
      {!isLoading && subscriptions.length > 0 && !hasActiveAccess && !hasLegacy && (
        <Button className="w-full" onClick={() => navigate('/subscription/purchase')}>
          {t('subscriptions.browsePlans', 'Посмотреть тарифы и купить подписку')}
        </Button>
      )}

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
            balanceKopeks={balanceData?.balance_kopeks ?? 0}
            balanceRubles={balanceData?.balance_rubles ?? 0}
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
            {t('subscriptions.browsePlans', 'Посмотреть тарифы и купить подписку')}
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

      {subscriptions.length > 0 && (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <SubscriptionListCard
              key={sub.id}
              subscription={sub}
              onClick={() => navigate(`/subscriptions/${sub.id}`)}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
