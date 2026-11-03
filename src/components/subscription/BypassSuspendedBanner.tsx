import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

interface BypassSuspendedBannerProps {
  /** Where «Продлить подписку» leads (purchase page or per-subscription renew).
   *  Omitted for a lifetime subscription: there is nothing to renew. */
  renewTo?: string;
  /** On the subscription page the traffic sheet opens in place. */
  onBuyTraffic?: () => void;
  /** Elsewhere «Докупить трафик» is a link that opens that sheet: the subscription
   *  page's own route, /subscriptions/:id?topup=traffic — /subscription redirects and
   *  drops the query. */
  trafficTo?: string;
  className?: string;
  /** Trial: traffic can't be bought — the only way back to bypass is a plan. */
  isTrial?: boolean;
}

/**
 * Spofy: the traffic quota of a bypass tariff ran out, so only the bypass
 * servers are switched off (squad Bypass-Off) — regular servers keep working.
 * A calm notice with the two ways back, not an alarm: the VPN is still on.
 */
export default function BypassSuspendedBanner({
  renewTo,
  onBuyTraffic,
  trafficTo,
  className = '',
  isTrial = false,
}: BypassSuspendedBannerProps) {
  const { t } = useTranslation();
  const primary =
    'inline-flex h-11 items-center justify-center rounded-2xl bg-accent-500 px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-600';
  const secondary =
    'inline-flex h-11 items-center justify-center rounded-2xl bg-dark-800/70 px-4 text-sm font-semibold text-dark-100 ring-1 ring-inset ring-dark-700/60 transition-colors hover:bg-dark-700/70';

  return (
    <div
      role="status"
      data-testid="bypass-suspended-banner"
      className={`rounded-3xl bg-warning-500/5 p-4 ring-1 ring-inset ring-warning-500/20 sm:p-5 ${className}`}
    >
      <p className="text-[15px] font-semibold text-dark-50">
        {t(
          isTrial
            ? 'subscription.bypassSuspended.trialTitle'
            : 'subscription.bypassSuspended.title',
        )}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-dark-400">
        {t(
          isTrial
            ? 'subscription.bypassSuspended.trialDescription'
            : 'subscription.bypassSuspended.description',
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isTrial ? (
          <Link to="/subscription/purchase" className={primary}>
            {t('subscription.bypassSuspended.trialCta')}
          </Link>
        ) : onBuyTraffic ? (
          <button type="button" onClick={onBuyTraffic} className={primary}>
            {t('subscription.bypassSuspended.buyTraffic')}
          </button>
        ) : (
          <Link to={trafficTo ?? '/subscriptions'} className={primary}>
            {t('subscription.bypassSuspended.buyTraffic')}
          </Link>
        )}
        {!isTrial && renewTo && (
          <Link to={renewTo} className={secondary}>
            {t('subscription.bypassSuspended.renew')}
          </Link>
        )}
      </div>
    </div>
  );
}
