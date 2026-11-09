import { useTranslation } from 'react-i18next';
import type { UserDetailResponse, UserPanelInfo, UserSubscriptionInfo } from '@/api/adminUsers';
import { SUBSCRIPTION_STATE_TONE, useMoney, useSignedMoney } from '@/components/admin/users';
import { copyToClipboard } from '@/utils/clipboard';
import { formatShortDate } from '@/utils/format';
import { KeyValues, LinkAction } from './sectionParts';

const ns = 'admin.users.detail.overview';
const RECENT_PAYMENTS = 5;

function statusKey(status: string): string {
  return status in SUBSCRIPTION_STATE_TONE ? status : 'other';
}

export function SubscriptionFacts({
  subscription,
  others,
  panelInfo,
}: {
  subscription: UserSubscriptionInfo | null;
  others: UserSubscriptionInfo[];
  panelInfo: UserPanelInfo | null;
}) {
  const { t } = useTranslation();
  if (!subscription) return <p className="text-sm text-dark-500">{t(`${ns}.noSubscription`)}</p>;

  const onOff = (value: boolean) => t(value ? `${ns}.yes` : `${ns}.no`);
  const traffic =
    subscription.traffic_limit_gb > 0
      ? `${subscription.traffic_used_gb.toFixed(1)} / ${subscription.traffic_limit_gb} ${t('common.units.gb')}`
      : `${subscription.traffic_used_gb.toFixed(1)} ${t('common.units.gb')} · ${t(`${ns}.unlimited`)}`;
  const link = panelInfo?.subscription_url;

  return (
    <KeyValues
      rows={[
        { key: 'tariff', label: t(`${ns}.tariff`), value: subscription.tariff_name ?? '—' },
        {
          key: 'status',
          label: t(`${ns}.status`),
          value: t(`admin.users.subscriptionState.${statusKey(subscription.status)}`),
        },
        {
          key: 'started',
          label: t(`${ns}.started`),
          value: subscription.start_date ? formatShortDate(subscription.start_date) : '—',
        },
        {
          key: 'until',
          label: t(`${ns}.until`),
          value: subscription.end_date
            ? `${formatShortDate(subscription.end_date)} · ${t(`${ns}.daysLeft`, { count: subscription.days_remaining })}`
            : '—',
        },
        { key: 'traffic', label: t(`${ns}.traffic`), value: traffic },
        ...(subscription.purchased_traffic_gb > 0
          ? [
              {
                key: 'purchased',
                label: t(`${ns}.purchasedTraffic`),
                value: `${subscription.purchased_traffic_gb} ${t('common.units.gb')}`,
              },
            ]
          : []),
        { key: 'devices', label: t(`${ns}.deviceLimit`), value: String(subscription.device_limit) },
        { key: 'autopay', label: t(`${ns}.autopay`), value: onOff(subscription.autopay_enabled) },
        { key: 'trial', label: t(`${ns}.trial`), value: onOff(subscription.is_trial) },
        ...(link
          ? [
              {
                key: 'link',
                label: t(`${ns}.subscriptionLink`),
                value: (
                  <LinkAction onClick={() => void copyToClipboard(link)}>
                    {t(`${ns}.copy`)}
                  </LinkAction>
                ),
              },
            ]
          : []),
        ...others.map((other) => ({
          key: `other-${other.id}`,
          label: t(`${ns}.otherSubscription`),
          value: `${other.tariff_name ?? `#${other.id}`} · ${
            other.end_date ? formatShortDate(other.end_date) : '—'
          }`,
        })),
      ]}
    />
  );
}

export function MoneyFacts({ user }: { user: UserDetailResponse }) {
  const { t } = useTranslation();
  const money = useMoney();
  const signed = useSignedMoney();
  const payments = user.recent_transactions.slice(0, RECENT_PAYMENTS);
  const discount = user.promo_offer_discount_percent;

  return (
    <div className="flex flex-col gap-3">
      <KeyValues
        rows={[
          { key: 'balance', label: t(`${ns}.balance`), value: money(user.balance_rubles) },
          {
            key: 'spent',
            label: t(`${ns}.totalSpent`),
            value: money(user.total_spent_kopeks / 100),
          },
          { key: 'purchases', label: t(`${ns}.purchases`), value: String(user.purchase_count) },
          {
            key: 'paid',
            label: t(`${ns}.hadPaid`),
            value: t(user.has_had_paid_subscription ? `${ns}.yes` : `${ns}.no`),
          },
          ...(discount > 0
            ? [
                {
                  key: 'discount',
                  label: t(`${ns}.offerDiscount`),
                  value: `${discount}%${
                    user.promo_offer_discount_expires_at
                      ? ` · ${formatShortDate(user.promo_offer_discount_expires_at)}`
                      : ''
                  }`,
                },
              ]
            : []),
        ]}
      />
      {payments.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-dark-400">
                {formatShortDate(payment.created_at)} · {payment.description ?? payment.type}
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums text-dark-100">
                {signed(payment.amount_rubles)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReferralFacts({ user }: { user: UserDetailResponse }) {
  const { t } = useTranslation();
  const money = useMoney();
  const { referral } = user;

  return (
    <KeyValues
      rows={[
        { key: 'code', label: t(`${ns}.referralCode`), value: referral.referral_code || '—' },
        { key: 'invited', label: t(`${ns}.invited`), value: String(referral.referrals_count) },
        {
          key: 'earned',
          label: t(`${ns}.earned`),
          value: money(referral.total_earnings_kopeks / 100),
        },
        {
          key: 'commission',
          label: t(`${ns}.commission`),
          value:
            referral.commission_percent === null
              ? t(`${ns}.commissionDefault`)
              : `${referral.commission_percent}%`,
        },
      ]}
    />
  );
}
