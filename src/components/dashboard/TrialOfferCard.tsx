import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TrialInfo } from '../../types';
import { useCurrency } from '../../hooks/useCurrency';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { BoltIcon, GiftIcon } from '@/components/icons';

interface TrialOfferCardProps {
  trialInfo: TrialInfo;
  balanceKopeks: number;
  balanceRubles: number;
  activateTrialMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trialError: string | null;
  /** Строка «Текущий баланс» у платного пробного периода. На главной баланс
   *  уже в карточке рядом — там её не дублируем. */
  showBalance?: boolean;
}

export default function TrialOfferCard({
  trialInfo,
  balanceKopeks,
  balanceRubles,
  activateTrialMutation,
  trialError,
  showBalance = true,
}: TrialOfferCardProps) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const isFree = !trialInfo.requires_payment;
  const canAfford = balanceKopeks >= trialInfo.price_kopeks;

  return (
    <div
      className="relative overflow-hidden rounded-3xl text-center"
      style={{
        // В тёмной теме — та же ступень, что у карточек рядом: белая дымка стекла
        // на тёмно-синем фоне выглядела темнее и выпадала из ряда.
        background: isDark ? 'rgb(var(--color-dark-900))' : g.cardBg,
        padding: '32px 28px 28px',
      }}
    >
      {/* Icon */}
      <div
        className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: isDark
            ? isFree
              ? 'linear-gradient(135deg, rgba(var(--color-accent-900), 0.5), rgba(var(--color-accent-950), 0.6))'
              : 'linear-gradient(135deg, rgba(var(--color-accent-900), 0.5), rgba(var(--color-accent-950), 0.6))'
            : isFree
              ? 'linear-gradient(135deg, rgba(var(--color-accent-400), 0.15), rgba(var(--color-accent-400), 0.08))'
              : 'linear-gradient(135deg, rgba(var(--color-accent-400), 0.15), rgba(var(--color-accent-400), 0.08))',
          transition: 'all 0.5s ease',
        }}
      >
        {isFree ? (
          <span
            className="flex"
            style={{ color: 'rgb(var(--color-accent-400))' }}
            aria-hidden="true"
          >
            <GiftIcon className="h-[26px] w-[26px]" />
          </span>
        ) : (
          <span
            className="flex"
            style={{ color: 'rgb(var(--color-urgent-400))' }}
            aria-hidden="true"
          >
            <BoltIcon className="h-[26px] w-[26px]" />
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="mb-1.5 text-[22px] font-bold tracking-tight text-dark-50">
        {isFree ? t('dashboard.trialOffer.freeTitle') : t('dashboard.trialOffer.paidTitle')}
      </h2>
      <p className="mb-5 text-sm text-dark-400">
        {isFree ? t('dashboard.trialOffer.freeDesc') : t('dashboard.trialOffer.paidDesc')}
      </p>

      {/* Price tag for paid trial */}
      {!isFree && trialInfo.price_rubles > 0 && (
        <div
          className="mb-5 inline-flex items-baseline gap-1 rounded-xl px-5 py-2"
          style={{
            background: 'rgba(var(--color-accent-400), 0.08)',
          }}
        >
          <span
            className="text-[32px] font-extrabold leading-none tracking-tight"
            style={{ color: 'rgb(var(--color-urgent-400))' }}
          >
            {trialInfo.price_rubles.toFixed(0)}
          </span>
          <span
            className="text-base font-semibold opacity-70"
            style={{ color: 'rgb(var(--color-urgent-400))' }}
          >
            {currencySymbol}
          </span>
        </div>
      )}

      {/* Trial stats */}
      <div className="mb-7 grid grid-cols-3 gap-2">
        {[
          {
            value: String(trialInfo.duration_days),
            label: t('subscription.trial.daysWord', { count: trialInfo.duration_days }),
          },
          {
            value: trialInfo.traffic_limit_gb === 0 ? '∞' : String(trialInfo.traffic_limit_gb),
            label: t('common.units.gb'),
          },
          {
            value: trialInfo.device_limit === 0 ? '∞' : String(trialInfo.device_limit),
            label: t('subscription.trial.devicesWord', { count: trialInfo.device_limit }),
          },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-4xl font-extrabold leading-none tracking-tight text-dark-50">
              {stat.value}
            </div>
            <div className="mt-1 text-xs font-medium text-dark-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Balance info for paid trial */}
      {!isFree && trialInfo.price_rubles > 0 && !showBalance && !canAfford && (
        <p className="mb-4 text-xs text-warning-400">
          {t('subscription.trial.insufficientBalance')}
        </p>
      )}
      {!isFree && trialInfo.price_rubles > 0 && showBalance && (
        <div className="mb-4 space-y-2 rounded-xl p-4 text-left" style={{ background: g.innerBg }}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">{t('balance.currentBalance')}</span>
            <span
              className={`font-display text-sm font-semibold ${canAfford ? 'text-success-400' : 'text-warning-400'}`}
            >
              {formatAmount(balanceRubles)}
              {'\u00A0'}
              {currencySymbol}
            </span>
          </div>
          {!canAfford && (
            <div className="text-xs text-warning-400">
              {t('subscription.trial.insufficientBalance')}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {trialError && (
        <div className="mb-4 rounded-xl bg-error-500/10 p-3 text-center text-sm text-error-400">
          {trialError}
        </div>
      )}

      {/* CTA Button */}
      {!isFree && trialInfo.price_kopeks > 0 ? (
        canAfford ? (
          <button
            onClick={() => !activateTrialMutation.isPending && activateTrialMutation.mutate()}
            disabled={activateTrialMutation.isPending}
            className="w-full rounded-[14px] bg-cta-500 py-4 text-base font-bold tracking-tight text-on-cta transition-all duration-300 hover:bg-cta-600 disabled:opacity-50"
          >
            {activateTrialMutation.isPending
              ? t('common.loading')
              : t('subscription.trial.payAndActivate')}
          </button>
        ) : (
          <Link
            to="/balance"
            className="block w-full rounded-[14px] bg-cta-500 py-4 text-center text-base font-bold tracking-tight text-on-cta transition-all duration-300 hover:bg-cta-600"
          >
            {t('subscription.trial.topUpToActivate')}
          </Link>
        )
      ) : (
        <button
          onClick={() => !activateTrialMutation.isPending && activateTrialMutation.mutate()}
          disabled={activateTrialMutation.isPending}
          // Единственная главная кнопка экрана без подписки.
          className="w-full rounded-[14px] bg-cta-500 py-4 text-base font-bold tracking-tight text-on-cta transition-all duration-300 hover:bg-cta-600 disabled:opacity-50"
        >
          {activateTrialMutation.isPending ? t('common.loading') : t('subscription.trial.activate')}
        </button>
      )}
    </div>
  );
}
