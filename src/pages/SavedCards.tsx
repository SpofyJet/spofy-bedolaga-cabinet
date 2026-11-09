import { uiLocale } from '@/utils/uiLocale';
import { useState } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  PiArrowsClockwiseDuotone,
  PiCreditCardDuotone,
  PiWarningCircleDuotone,
} from 'react-icons/pi';

import { balanceApi } from '../api/balance';
import { subscriptionApi } from '../api/subscription';
import { useToast } from '../components/Toast';
import { useDestructiveConfirm } from '../platform/hooks/useNativeDialog';
import type { SbpRecurringInfo, SubscriptionListItem } from '../types';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Group, Page, RowIcon } from '@/components/spofy/ui';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

function formatCardDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(uiLocale());
  } catch {
    return dateStr;
  }
}

/** Human-readable locale key for an SBP binding status (mirrors Subscription.tsx). */
function sbpStatusLabelKey(status: string): string | null {
  switch (status) {
    case 'PENDING':
      return 'subscription.sbpRecurring.statusPending';
    case 'ACTIVE':
      return 'subscription.sbpRecurring.statusActive';
    case 'PAST_DUE':
      return 'subscription.sbpRecurring.statusPastDue';
    default:
      return null;
  }
}

interface SbpBinding {
  sub: SubscriptionListItem;
  info: SbpRecurringInfo;
}

export default function SavedCards() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirmDelete = useDestructiveConfirm();

  const {
    data: savedCardsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['saved-cards'],
    queryFn: balanceApi.getSavedCards,
  });
  const savedCards = savedCardsData?.cards;

  const [deletingCardId, setDeletingCardId] = useState<number | null>(null);

  const handleDeleteCard = async (cardId: number) => {
    if (deletingCardId !== null) return;
    const confirmed = await confirmDelete(
      t('balance.savedCards.confirmUnlink'),
      t('balance.savedCards.unlink'),
    );
    if (!confirmed) return;
    setDeletingCardId(cardId);
    try {
      await balanceApi.deleteSavedCard(cardId);
      await queryClient.invalidateQueries({ queryKey: ['saved-cards'] });
      showToast({
        type: 'success',
        title: t('balance.savedCards.unlinkSuccess'),
        message: '',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to unlink card:', error);
      showToast({
        type: 'error',
        title: t('balance.savedCards.unlinkError'),
        message: '',
        duration: 3000,
      });
    } finally {
      setDeletingCardId(null);
    }
  };

  // ── SBP (Platega) recurring bindings ────────────────────────────────
  // Same query-key convention as the Subscription page (['sbp-recurring', subId])
  // so the caches are shared and don't refetch redundantly when navigating
  // between the two pages.
  const { data: subscriptionsData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: subscriptionApi.getSubscriptions,
  });
  const nonTrialSubs = (subscriptionsData?.subscriptions ?? []).filter((sub) => !sub.is_trial);

  // Опций покупки здесь нет, поэтому фичу проверяем пробой: спрашиваем первую
  // подписку, а остальные — только если ответ пришёл. Выключенная автооплата
  // отвечает 403, и без пробы браузер печатал бы красную строку с полным стеком
  // на КАЖДУЮ подписку человека.
  const probeSub = nonTrialSubs[0];
  const probeQuery = useQuery({
    queryKey: ['sbp-recurring', probeSub?.id],
    queryFn: () => subscriptionApi.getSbpRecurring(probeSub.id),
    enabled: !!probeSub,
    retry: false,
  });
  const restQueries = useQueries({
    queries: nonTrialSubs.slice(1).map((sub) => ({
      queryKey: ['sbp-recurring', sub.id],
      queryFn: () => subscriptionApi.getSbpRecurring(sub.id),
      enabled: probeQuery.isSuccess,
      retry: false,
    })),
  });
  const sbpQueries = [probeQuery, ...restQueries];

  // No section at all when nothing is bound: either the feature is off
  // (every query 403s) or none of the subscriptions has an active binding.
  const sbpBindings: SbpBinding[] = nonTrialSubs.reduce<SbpBinding[]>((acc, sub, index) => {
    const info = sbpQueries[index]?.data;
    if (info && info.status !== 'none') {
      acc.push({ sub, info });
    }
    return acc;
  }, []);

  const [unlinkingSubId, setUnlinkingSubId] = useState<number | null>(null);
  const confirmUnlinkSbp = useDestructiveConfirm();

  const handleUnlinkSbp = async (subId: number) => {
    if (unlinkingSubId !== null) return;
    const confirmed = await confirmUnlinkSbp(
      t('subscription.sbpRecurring.confirmCancel'),
      t('subscription.sbpRecurring.cancel'),
    );
    if (!confirmed) return;
    setUnlinkingSubId(subId);
    try {
      await subscriptionApi.cancelSbpRecurring(subId);
      await queryClient.invalidateQueries({ queryKey: ['sbp-recurring', subId] });
      showToast({
        type: 'success',
        title: t('subscription.sbpRecurring.cancelled'),
        message: '',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to unlink SBP binding:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        message: '',
        duration: 3000,
      });
    } finally {
      setUnlinkingSubId(null);
    }
  };

  return (
    <Page>
      <PageHeader title={t('balance.savedCards.pageTitle')} backTo="/balance" />

      {isLoading && (
        <Group>
          <SkeletonGroup className="divide-y divide-dark-800/70">
            {[1, 2].map((i) => (
              <div key={i} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0" />
              </div>
            ))}
          </SkeletonGroup>
        </Group>
      )}

      {isError && (
        <EmptyState
          icon={<PiWarningCircleDuotone />}
          title={t('common.error')}
          text={t('balance.savedCards.loadError')}
        />
      )}

      {!isLoading && !isError && savedCards && savedCards.length > 0 ? (
        <Group title={t('balance.savedCards.cardsSection', 'Карты')}>
          {savedCards.map((card) => (
            <div key={card.id} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
              <RowIcon tone="money">
                <PiCreditCardDuotone />
              </RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-dark-100 [overflow-wrap:anywhere]">
                  {card.title ||
                    `${card.card_type || t('balance.savedCards.card')} ${card.card_last4 ? `•${card.card_last4}` : ''}`}
                </span>
                <span className="mt-0.5 block text-[13px] text-dark-400">
                  {card.title && card.card_last4 ? `•${card.card_last4} · ` : ''}
                  {t('balance.savedCards.linkedAt', {
                    date: formatCardDate(card.created_at),
                  })}
                </span>
              </span>
              <UnlinkButton
                label={t('balance.savedCards.unlink')}
                loading={deletingCardId === card.id}
                onClick={() => handleDeleteCard(card.id)}
              />
            </div>
          ))}
        </Group>
      ) : !isLoading && !isError && savedCards ? (
        <EmptyState
          icon={<PiCreditCardDuotone />}
          title={t('balance.savedCards.emptyTitle', 'Карт пока нет')}
          text={t('balance.savedCards.noCards')}
        />
      ) : null}

      {/* SBP (Platega) recurring bindings — convenience mirror of the
          per-subscription block on the Subscription page. Rendered only
          when at least one non-trial subscription has an active binding;
          hidden entirely when the feature is off or nothing is bound. */}
      {sbpBindings.length > 0 && (
        <Group title={t('balance.savedCards.sbpSection')}>
          {sbpBindings.map(({ sub, info }) => {
            const statusKey = sbpStatusLabelKey(info.status);
            return (
              <div key={sub.id} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
                <RowIcon tone={info.status === 'PAST_DUE' ? 'warning' : 'money'}>
                  <PiArrowsClockwiseDuotone />
                </RowIcon>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-dark-100">
                    {sub.tariff_name || `#${sub.id}`}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-dark-400">
                    {t('balance.savedCards.sbpBinding')}
                    {statusKey ? ` · ${t(statusKey)}` : ''}
                    {info.next_charge_at
                      ? ` · ${t('subscription.sbpRecurring.nextCharge', {
                          date: new Date(info.next_charge_at).toLocaleDateString(uiLocale(), {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          }),
                        })}`
                      : ''}
                  </span>
                </span>
                <UnlinkButton
                  label={t('balance.savedCards.sbpUnlinkShort', 'Отключить')}
                  ariaLabel={t('balance.savedCards.sbpUnlink')}
                  loading={unlinkingSubId === sub.id}
                  onClick={() => handleUnlinkSbp(sub.id)}
                />
              </div>
            );
          })}
        </Group>
      )}
    </Page>
  );
}

/** Небольшая кнопка «Отвязать» справа в строке. */
function UnlinkButton({
  label,
  ariaLabel,
  loading,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      tone="danger"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      className="h-9 shrink-0 rounded-xl px-3 text-[13px]"
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {label}
    </Button>
  );
}
