import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi, type NotificationSettings } from '../api/notifications';
import { Card } from '@/components/data-display/Card';
import { Switch } from '@/components/primitives/Switch';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { ProfileSubHeader } from '@/components/profile/ProfileSubHeader';
import { cn } from '@/lib/utils';

/** Выбор одного значения из нескольких: выбранное показано заливкой. */
function Segments({
  label,
  options,
  value,
  onChange,
  suffix = '',
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={cn(
            'h-11 min-w-0 flex-1 rounded-xl text-[14px] font-semibold tabular-nums transition-colors',
            option === value
              ? 'bg-accent-500/15 text-accent-400'
              : 'bg-dark-800/60 text-dark-300 hover:bg-dark-700/60',
          )}
        >
          {option}
          {suffix}
        </button>
      ))}
    </div>
  );
}

/** Уведомления — отдельная страница профиля. */
export default function ProfileNotifications() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: notificationSettings, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  const toggle = (key: keyof NotificationSettings, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const setValue = (key: keyof NotificationSettings, value: number) => {
    updateMutation.mutate({ [key]: value });
  };

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <ProfileSubHeader title={t('profile.notifications.title')} />

      <Card>
        {isLoading ? (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16" />
          </SkeletonGroup>
        ) : notificationSettings ? (
          <div className="space-y-6">
            {/* Окончание подписки */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-dark-100">
                    {t('profile.notifications.subscriptionExpiry')}
                  </p>
                  <p className="text-sm text-dark-400">
                    {t('profile.notifications.subscriptionExpiryDesc')}
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.subscription_expiry_enabled}
                  onCheckedChange={(checked) => toggle('subscription_expiry_enabled', checked)}
                />
              </div>
              {notificationSettings.subscription_expiry_enabled && (
                <div className="space-y-2">
                  <span className="block text-sm text-dark-400">
                    {t('profile.notifications.daysBeforeExpiry')}
                  </span>
                  <Segments
                    label={t('profile.notifications.daysBeforeExpiry')}
                    options={[1, 2, 3, 5, 7, 14]}
                    value={notificationSettings.subscription_expiry_days}
                    onChange={(d) => setValue('subscription_expiry_days', d)}
                  />
                </div>
              )}
            </div>

            {/* Трафик */}
            <div className="space-y-3 border-t border-dark-800/50 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-dark-100">
                    {t('profile.notifications.trafficWarning')}
                  </p>
                  <p className="text-sm text-dark-400">
                    {t('profile.notifications.trafficWarningDesc')}
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.traffic_warning_enabled}
                  onCheckedChange={(checked) => toggle('traffic_warning_enabled', checked)}
                />
              </div>
              {notificationSettings.traffic_warning_enabled && (
                <div className="space-y-2">
                  <span className="block text-sm text-dark-400">
                    {t('profile.notifications.atPercent')}
                  </span>
                  <Segments
                    label={t('profile.notifications.atPercent')}
                    options={[50, 70, 80, 90, 95]}
                    value={notificationSettings.traffic_warning_percent}
                    onChange={(p) => setValue('traffic_warning_percent', p)}
                    suffix="%"
                  />
                </div>
              )}
            </div>

            {/* Баланс */}
            <div className="space-y-3 border-t border-dark-800/50 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-dark-100">
                    {t('profile.notifications.balanceLow')}
                  </p>
                  <p className="text-sm text-dark-400">
                    {t('profile.notifications.balanceLowDesc')}
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.balance_low_enabled}
                  onCheckedChange={(checked) => toggle('balance_low_enabled', checked)}
                />
              </div>
              {notificationSettings.balance_low_enabled && (
                <div className="space-y-2">
                  <span className="block text-sm text-dark-400">
                    {t('profile.notifications.threshold')}
                  </span>
                  <input
                    type="number"
                    value={notificationSettings.balance_low_threshold}
                    onChange={(e) => setValue('balance_low_threshold', Number(e.target.value))}
                    min={0}
                    className="input w-24 py-1"
                  />
                </div>
              )}
            </div>

            {/* Новости */}
            <div className="flex items-center justify-between border-t border-dark-800/50 pt-6">
              <div>
                <p className="font-medium text-dark-100">{t('profile.notifications.news')}</p>
                <p className="text-sm text-dark-400">{t('profile.notifications.newsDesc')}</p>
              </div>
              <Switch
                checked={notificationSettings.news_enabled}
                onCheckedChange={(checked) => toggle('news_enabled', checked)}
              />
            </div>

            {/* Промо */}
            <div className="flex items-center justify-between border-t border-dark-800/50 pt-6">
              <div>
                <p className="font-medium text-dark-100">
                  {t('profile.notifications.promoOffers')}
                </p>
                <p className="text-sm text-dark-400">
                  {t('profile.notifications.promoOffersDesc')}
                </p>
              </div>
              <Switch
                checked={notificationSettings.promo_offers_enabled}
                onCheckedChange={(checked) => toggle('promo_offers_enabled', checked)}
              />
            </div>
          </div>
        ) : (
          <p className="text-dark-400">{t('profile.notifications.unavailable')}</p>
        )}
      </Card>
    </div>
  );
}
