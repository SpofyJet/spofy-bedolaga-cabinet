import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCaretDownBold, PiCheckBold, PiCopyDuotone } from 'react-icons/pi';

import { Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import type { PartnerCampaignInfo } from '../../api/partners';
import { PARTNER_STATS } from '../../constants/partner';
import { useCurrency } from '../../hooks/useCurrency';
import { useHaptic } from '../../platform';
import { copyToClipboard } from '../../utils/clipboard';
import { CampaignDetailStats } from './CampaignDetailStats';
import { MiniStat } from './MiniStat';

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <PiCaretDownBold className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
);

function CampaignLink({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-1.5 px-1 text-[13px] font-medium text-dark-400">{label}</div>
      <div className="flex min-h-12 items-center gap-2 rounded-2xl bg-dark-800/60 py-1.5 pl-4 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-sm text-dark-100" title={value}>
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? t('referral.copied') : t('referral.copyLink')}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
            copied
              ? 'bg-success-500/15 text-success-400'
              : 'bg-dark-700/60 text-dark-200 hover:bg-dark-700',
          )}
        >
          {copied ? (
            <PiCheckBold className="h-4 w-4" />
          ) : (
            <PiCopyDuotone className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}

interface CampaignCardProps {
  campaign: PartnerCampaignInfo;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const { t } = useTranslation();
  const { formatWithCurrency, formatPositive } = useCurrency();
  const haptic = useHaptic();
  const [expanded, setExpanded] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleCopy = useCallback(
    async (url: string, key: string) => {
      try {
        await copyToClipboard(url);
        haptic.notification('success');
        setCopiedLink(key);
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(
          () => setCopiedLink(null),
          PARTNER_STATS.COPY_FEEDBACK_MS,
        );
      } catch {
        haptic.notification('error');
      }
    },
    [haptic],
  );

  const handleToggleExpand = useCallback(() => {
    haptic.impact('light');
    setExpanded((prev) => !prev);
  }, [haptic]);

  const botKey = `${campaign.id}-bot`;
  const webKey = `${campaign.id}-web`;

  return (
    <Surface className="space-y-4">
      {/* Campaign header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[15px] font-semibold text-dark-100">
          {campaign.name}
        </h3>
        <button
          onClick={handleToggleExpand}
          aria-expanded={expanded}
          aria-controls={`campaign-detail-${campaign.id}`}
          className="flex shrink-0 items-center gap-1 text-sm text-accent-400 transition-colors hover:text-accent-300"
        >
          <span>
            {expanded
              ? t('referral.partner.stats.hideDetails')
              : t('referral.partner.stats.showDetails')}
          </span>
          <ChevronIcon expanded={expanded} />
        </button>
      </div>

      {/* Basic stats -- always visible */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat
          label={t('referral.partner.stats.registrations')}
          value={campaign.registrations_count}
        />
        <MiniStat
          label={t('referral.partner.stats.referrals')}
          value={campaign.referrals_count}
          tone="accent"
        />
        <MiniStat
          label={t('referral.partner.stats.earnings')}
          value={formatPositive(campaign.earnings_kopeks / PARTNER_STATS.KOPEKS_DIVISOR)}
          tone="success"
        />
      </div>

      {/* Bonus info */}
      {campaign.bonus_type !== 'none' && (
        <div className="rounded-2xl bg-success-500/10 p-3">
          <div className="mb-0.5 text-xs font-medium text-success-400">
            {t('referral.partner.campaignBonus.title')}
          </div>
          <div className="text-sm font-semibold text-success-400">
            {campaign.bonus_type === 'balance' &&
              t('referral.partner.campaignBonus.balanceDesc', {
                amount: formatWithCurrency(
                  campaign.balance_bonus_kopeks / PARTNER_STATS.KOPEKS_DIVISOR,
                  0,
                ),
              })}
            {campaign.bonus_type === 'subscription' &&
              t('referral.partner.campaignBonus.subscriptionDesc', {
                days: campaign.subscription_duration_days ?? 0,
                ...(campaign.subscription_traffic_gb
                  ? { traffic: campaign.subscription_traffic_gb }
                  : {}),
              })}
            {campaign.bonus_type === 'tariff' && t('referral.partner.campaignBonus.tariffDesc')}
          </div>
        </div>
      )}

      {/* Bot link */}
      {campaign.deep_link && (
        <CampaignLink
          label={t('referral.partner.campaignLinks.bot')}
          value={campaign.deep_link}
          copied={copiedLink === botKey}
          onCopy={() => handleCopy(campaign.deep_link ?? '', botKey)}
        />
      )}

      {/* Web link */}
      {campaign.web_link && (
        <CampaignLink
          label={t('referral.partner.campaignLinks.web')}
          value={campaign.web_link}
          copied={copiedLink === webKey}
          onCopy={() => handleCopy(campaign.web_link ?? '', webKey)}
        />
      )}

      {/* Expanded detail stats */}
      <div id={`campaign-detail-${campaign.id}`}>
        {expanded && <CampaignDetailStats campaignId={campaign.id} />}
      </div>
    </Surface>
  );
}
