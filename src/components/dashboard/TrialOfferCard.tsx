import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TrialInfo } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { GiftIcon } from '@/components/icons';

interface TrialOfferCardProps {
  trialInfo: TrialInfo;
  activateTrialMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trialError: string | null;
}

export default function TrialOfferCard({
  trialInfo,
  activateTrialMutation,
  trialError,
}: TrialOfferCardProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

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
            ? 'linear-gradient(135deg, rgba(var(--color-accent-900), 0.5), rgba(var(--color-accent-950), 0.6))'
            : 'linear-gradient(135deg, rgba(var(--color-accent-400), 0.15), rgba(var(--color-accent-400), 0.08))',
          transition: 'all 0.5s ease',
        }}
      >
        <span className="flex" style={{ color: 'rgb(var(--color-accent-400))' }} aria-hidden="true">
          <GiftIcon className="h-[26px] w-[26px]" />
        </span>
      </div>

      {/* Title */}
      <h2 className="mb-5 font-display text-[22px] font-bold tracking-tight text-dark-50">
        {t('dashboard.trialOffer.freeTitle')}
      </h2>

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
            <div className="font-display text-4xl font-bold leading-none tracking-tight text-dark-50">
              {stat.value}
            </div>
            <div className="mt-1 text-xs font-medium text-dark-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {trialError && (
        <div className="mb-4 rounded-xl bg-error-500/10 p-3 text-center text-sm text-error-400">
          {trialError}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={() => !activateTrialMutation.isPending && activateTrialMutation.mutate()}
        disabled={activateTrialMutation.isPending}
        // Единственная главная кнопка экрана без подписки.
        aria-busy={activateTrialMutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-cta-500 py-4 text-base font-bold tracking-tight text-on-cta transition-all duration-300 hover:bg-cta-600 disabled:opacity-50"
      >
        {activateTrialMutation.isPending && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {t('subscription.trial.activate')}
      </button>
    </div>
  );
}
