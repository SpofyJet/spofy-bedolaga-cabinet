import { isLifetimePeriod } from '@/utils/lifetime';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GiftIcon } from '@/components/icons';
import type { PendingGift } from '../../api/gift';
import { plainTariffName } from '@/utils/plainTariffName';

interface PendingGiftCardProps {
  gifts: PendingGift[];
  className?: string;
}

export default function PendingGiftCard({ gifts, className }: PendingGiftCardProps) {
  const { t } = useTranslation();

  if (gifts.length === 0) return null;

  return (
    <div className={className ?? 'space-y-3'}>
      {gifts.map((gift) => (
        <motion.div
          key={gift.token}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-dark-900/70 p-5"
        >
          <div className="relative flex items-start gap-4">
            {/* Gift icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-500/20">
              <GiftIcon className="h-6 w-6 text-accent-400" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-dark-50">{t('gift.pending.title')}</h3>
              <p className="mt-0.5 text-xs text-dark-300">
                {gift.tariff_name && (
                  <span>
                    {plainTariffName(gift.tariff_name)} —{' '}
                    {isLifetimePeriod(gift.period_days)
                      ? t('subscription.lifetime.forever')
                      : `${gift.period_days} ${t('gift.days')}`}
                  </span>
                )}
                {gift.sender_display && (
                  <span className="ml-1 text-dark-400">
                    {t('gift.pending.from', { sender: gift.sender_display })}
                  </span>
                )}
              </p>
              {gift.gift_message && (
                <p className="mt-1.5 line-clamp-2 text-xs italic text-dark-400">
                  &ldquo;{gift.gift_message}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Кнопка под текстом на всю ширину: рядом с ним она сжимала текст в столбик. */}
          <Link
            to={`/gift?tab=activate&code=${gift.token}`}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-cta-500 px-5 text-[15px] font-semibold text-on-cta transition-colors hover:bg-cta-600"
          >
            {t('gift.pending.activate')}
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
