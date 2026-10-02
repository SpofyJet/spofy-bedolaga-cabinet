import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

interface BypassSuspendedBannerProps {
  /** Where «Продлить подписку» leads (purchase page or per-subscription renew). */
  renewTo: string;
  /** On the subscription page the traffic sheet opens in place. */
  onBuyTraffic?: () => void;
  /** Elsewhere «Докупить трафик» is a link that opens that sheet. */
  trafficTo?: string;
  className?: string;
}

/**
 * Spofy: the traffic quota of a bypass tariff ran out, so only the bypass
 * servers are switched off (squad Bypass-Off) — regular servers keep working.
 * A calm notice with the two ways back, not an alarm: the VPN is still on.
 */
export default function BypassSuspendedBanner({
  renewTo,
  onBuyTraffic,
  trafficTo = '/subscription?topup=traffic',
  className = '',
}: BypassSuspendedBannerProps) {
  const { t } = useTranslation();
  const primary =
    'inline-flex min-h-[40px] items-center justify-center rounded-xl bg-accent-500 px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-400';
  const secondary =
    'inline-flex min-h-[40px] items-center justify-center rounded-xl border border-dark-700/60 px-4 text-sm font-medium text-dark-100 transition-colors hover:bg-dark-700/40';

  return (
    <div
      role="status"
      data-testid="bypass-suspended-banner"
      className={`rounded-[14px] p-4 ${className}`}
      style={{
        background: 'rgba(var(--color-warning-400), 0.06)',
        border: '1px solid rgba(var(--color-warning-400), 0.18)',
      }}
    >
      <p className="text-sm font-semibold text-dark-50">
        {t('subscription.bypassSuspended.title')}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-dark-400">
        {t('subscription.bypassSuspended.description')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onBuyTraffic ? (
          <button type="button" onClick={onBuyTraffic} className={primary}>
            {t('subscription.bypassSuspended.buyTraffic')}
          </button>
        ) : (
          <Link to={trafficTo} className={primary}>
            {t('subscription.bypassSuspended.buyTraffic')}
          </Link>
        )}
        <Link to={renewTo} className={secondary}>
          {t('subscription.bypassSuspended.renew')}
        </Link>
      </div>
    </div>
  );
}
