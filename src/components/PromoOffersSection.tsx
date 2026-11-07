import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { promoApi, type PromoOffer } from '../api/promo';
import { getApiErrorMessage } from '../utils/api-error';
import { ClockIcon, CheckIcon, GiftIcon, PercentIcon, RocketIcon, XCircleIcon } from './icons';
import { Button, RowIcon } from '@/components/spofy/ui';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

// Helper functions
const formatTimeLeft = (
  expiresAt: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const now = new Date();
  // Ensure UTC parsing - if no timezone specified, assume UTC
  let expires: Date;
  if (expiresAt.includes('Z') || expiresAt.includes('+') || expiresAt.includes('-', 10)) {
    expires = new Date(expiresAt);
  } else {
    // No timezone - treat as UTC
    expires = new Date(expiresAt + 'Z');
  }
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return t('promo.offers.expired');

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} ${t('promo.time.days')}`;
  }
  if (hours > 0) {
    return `${hours}${t('promo.time.hours')} ${minutes}${t('promo.time.minutes')}`;
  }
  // Последний час идёт «живым» таймером ММ:СС: срочность видна, а не «около 47 мин».
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getOfferIcon = (effectType: string, discountPercent?: number | null) => {
  if (effectType === 'test_access') return <RocketIcon />;
  if (discountPercent) return <PercentIcon />;
  return <GiftIcon />;
};

const getOfferTitle = (
  offer: PromoOffer,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (offer.effect_type === 'test_access') {
    return t('promo.offers.testAccess');
  }
  if (offer.discount_percent) {
    return t('promo.offers.discountPercent', { percent: offer.discount_percent });
  }
  return t('promo.offers.specialOffer');
};

const getOfferDescription = (
  offer: PromoOffer,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (offer.effect_type === 'test_access') {
    const squads = offer.extra_data?.test_squad_uuids?.length || 0;
    return squads > 0
      ? t('promo.offers.serverAccess', { count: squads })
      : t('promo.offers.additionalServers');
  }
  return t('promo.offers.activateDiscountHint');
};

interface PromoOffersSectionProps {
  className?: string;
}

export default function PromoOffersSection({ className = '' }: PromoOffersSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmDeactivate = useDestructiveConfirm();
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Тик раз в секунду, пока у скидки есть срок: таймер идёт, а по истечении скидка исчезает без перезагрузки.
  const [, setTick] = useState(0);

  // Fetch available offers
  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ['promo-offers'],
    queryFn: promoApi.getOffers,
    staleTime: 30000,
  });

  // Fetch active discount
  const { data: activeDiscount } = useQuery({
    queryKey: ['active-discount'],
    queryFn: promoApi.getActiveDiscount,
    staleTime: 30000,
  });

  const discountExpiresAt = activeDiscount?.expires_at ?? null;
  useEffect(() => {
    if (!discountExpiresAt) return;
    const expiresMs = new Date(
      /Z|[+-]\d\d:?\d\d$/.test(discountExpiresAt) ? discountExpiresAt : `${discountExpiresAt}Z`,
    ).getTime();
    let refreshed = false;
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      if (!refreshed && Date.now() >= expiresMs) {
        refreshed = true;
        queryClient.invalidateQueries({ queryKey: ['active-discount'] });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [discountExpiresAt, queryClient]);

  // Claim offer mutation
  const claimMutation = useMutation({
    mutationFn: promoApi.claimOffer,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['promo-offers'] });
      queryClient.invalidateQueries({ queryKey: ['active-discount'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      setSuccessMessage(result.message);
      setClaimingId(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (error: unknown) => {
      setErrorMessage(getApiErrorMessage(error, t('promo.offers.activationFailed')));
      setClaimingId(null);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Deactivate discount mutation.
  // A discount granted by a PROMOCODE must be turned off via the dedicated route
  // (POST /cabinet/promocode/deactivate-discount), which also rolls back the promocode
  // usage (deletes the PromoCodeUse, decrements current_uses, strips the promo group) so
  // the user can re-activate it later. The plain clearActiveDiscount route only zeroes
  // the discount fields and is correct for admin/offer-sourced discounts.
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const source = activeDiscount?.source ?? '';
      if (source.startsWith('promocode:')) {
        await promoApi.deactivateDiscount();
      } else {
        await promoApi.clearActiveDiscount();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-discount'] });
      queryClient.invalidateQueries({ queryKey: ['promo-offers'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });

      setSuccessMessage(t('promo.deactivate.success'));
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (error: unknown) => {
      // detail may be a plain string (clearActiveDiscount route) or a structured
      // { code, message } object (deactivate-discount route). Handle both.
      const axiosErr = error as {
        response?: { data?: { detail?: string | { message?: string } } };
      };
      const detail = axiosErr.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message;
      setErrorMessage(message || t('promo.deactivate.error'));

      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleClaim = (offerId: number) => {
    setClaimingId(offerId);
    setErrorMessage(null);
    setSuccessMessage(null);
    claimMutation.mutate(offerId);
  };

  const handleUseNow = () => {
    navigate('/subscription/purchase');
  };

  const handleDeactivateClick = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const confirmed = await confirmDeactivate(
      t('promo.deactivate.confirmDescription', {
        percent: activeDiscount?.discount_percent || 0,
      }),
      t('promo.deactivate.confirm'),
      t('promo.deactivate.confirmTitle'),
    );
    if (confirmed) {
      deactivateMutation.mutate();
    }
  };

  // Filter unclaimed and active offers
  const availableOffers = offers.filter((o) => o.is_active && !o.is_claimed);

  // Don't render if no offers and no active discount
  if (
    !offersLoading &&
    availableOffers.length === 0 &&
    (!activeDiscount || !activeDiscount.is_active)
  ) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Действующая скидка: одна плоская карточка, главная кнопка — «Использовать». */}
      {activeDiscount && activeDiscount.is_active && activeDiscount.discount_percent > 0 && (
        <div className="rounded-3xl bg-dark-900/70 p-4">
          <div className="flex items-center gap-3">
            <RowIcon tone="success">
              <PercentIcon />
            </RowIcon>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-dark-100">
                  {t('promo.offers.discountActiveTitle', {
                    percent: activeDiscount.discount_percent,
                  })}
                </h3>
                <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-2xs font-semibold text-success-400">
                  −{activeDiscount.discount_percent}%
                </span>
              </div>
              {activeDiscount.expires_at && (
                <div className="mt-0.5 flex items-center gap-1 text-[13px] text-dark-400">
                  <ClockIcon className="h-3.5 w-3.5" />
                  <span>
                    {t('promo.offers.expires', {
                      time: formatTimeLeft(activeDiscount.expires_at, t),
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto sm:flex-1" onClick={handleUseNow}>
              {t('promo.useNow')}
            </Button>
            <Button tone="ghost" onClick={handleDeactivateClick} className="text-dark-400">
              <XCircleIcon className="h-4 w-4" />
              {t('promo.deactivate.button')}
            </Button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl bg-success-500/10 p-4 text-[15px] text-success-400">
          <CheckIcon />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl bg-error-500/10 p-4 text-[15px] text-error-400">
          {errorMessage}
        </div>
      )}

      {availableOffers.map((offer) => (
        <div key={offer.id} className="rounded-3xl bg-dark-900/70 p-4">
          <div className="flex items-start gap-3">
            <RowIcon tone="accent">
              {getOfferIcon(offer.effect_type, offer.discount_percent)}
            </RowIcon>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-dark-100">
                  {getOfferTitle(offer, t)}
                </h3>
                {offer.effect_type === 'test_access' && (
                  <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-2xs font-semibold text-accent-300">
                    {t('promo.offers.test')}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-dark-400">
                {getOfferDescription(offer, t)}
              </p>
              <div className="mt-1.5 flex items-center gap-1 text-[13px] text-dark-400">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>
                  {t('promo.offers.remaining', { time: formatTimeLeft(offer.expires_at, t) })}
                </span>
              </div>
            </div>
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => handleClaim(offer.id)}
            disabled={claimingId === offer.id}
            aria-busy={claimingId === offer.id}
          >
            {claimingId === offer.id && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
            {t('promo.offers.activate')}
          </Button>
        </div>
      ))}

      {offersLoading && (
        <div className="rounded-3xl bg-dark-900/70 p-4">
          <SkeletonGroup className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </SkeletonGroup>
        </div>
      )}
    </div>
  );
}
