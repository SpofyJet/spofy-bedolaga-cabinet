import { tariffTrafficLabel } from '../../../utils/tariffTrafficLabel';
import { useTranslation } from 'react-i18next';
import { BestValueBadge, bestValueFrame } from '../BestValueBadge';
import { useNavigate } from 'react-router';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from './dailyPrice';
import type { ReactNode } from 'react';
import {
  PiArrowsClockwiseDuotone,
  PiChartPieSliceDuotone,
  PiCheckCircleDuotone,
  PiDevicesDuotone,
  PiGiftDuotone,
} from 'react-icons/pi';
import { Button, Chip, EmptyState, RowIcon } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import type { Tariff, Subscription, PurchaseOptions } from '../../../types';
import { tariffAction, type TariffActionKind } from './tariffAction';

/** Подпись кнопки для действий, которые ведут в один и тот же сценарий выбора. */
const TARIFF_ACTION_LABEL: Record<Exclude<TariffActionKind, 'current-daily' | 'switch'>, string> = {
  extend: 'subscription.extend',
  moveToTariff: 'subscription.cta.moveToTariff',
  purchase: 'subscription.purchase',
};

// ──────────────────────────────────────────────────────────────────
// TariffPickerGrid
//
// The tariff selection surface inside SubscriptionPurchase. Renders:
//   - an optional promo-group banner when any tariff carries a
//     promo_group_name
//   - the "all tariffs purchased" empty state (multi-tariff mode)
//   - the grid itself (1 col mobile, 2 cols sm+) with promo prices,
//     per-tariff CTAs differentiated by user state (extend / switch /
//     purchase / legacy renewal)
//
// Owns nothing — pure presentation that calls back into the parent
// for selection (`onSelectTariff`) and switch (`onSwitchTariff`).
// ──────────────────────────────────────────────────────────────────

export interface TariffPickerGridProps {
  tariffs: Tariff[];
  subscription: Subscription | null;
  purchaseOptions: PurchaseOptions | undefined;
  isTariffsMode: boolean;
  isMultiTariff: boolean;
  subscriptionId?: number;
  switchSelection?: boolean;
  onSelectTariff: (tariff: Tariff) => void;
  onSwitchTariff: (tariffId: number) => void;
}

export function TariffPickerGrid({
  tariffs,
  subscription,
  purchaseOptions,
  isTariffsMode,
  isMultiTariff,
  subscriptionId,
  switchSelection = false,
  onSelectTariff,
  onSwitchTariff,
}: TariffPickerGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();

  // Целые суммы без «,00»: «299 ₽», а не «299,00 ₽».
  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100).replace(/[.,]00$/, '')}\u00A0${currencySymbol}`;

  return (
    <>
      {/* Promo group discount banner */}
      {tariffs.some((tariff) => tariff.promo_group_name) && (
        <div className="mb-4 flex items-center gap-3 rounded-3xl bg-success-500/5 p-4 ring-1 ring-inset ring-success-500/20">
          <RowIcon tone="success">
            <PiGiftDuotone />
          </RowIcon>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-success-400">
              {t('subscription.promoGroup.yourGroup', {
                name: tariffs.find((tariff) => tariff.promo_group_name)?.promo_group_name,
              })}
            </div>
            <div className="text-[13px] text-dark-400">
              {t('subscription.promoGroup.personalDiscountsApplied')}
            </div>
          </div>
        </div>
      )}

      {/* Tariff Grid */}
      {isMultiTariff &&
        purchaseOptions &&
        'all_tariffs_purchased' in purchaseOptions &&
        purchaseOptions.all_tariffs_purchased && (
          <EmptyState
            icon={<PiCheckCircleDuotone />}
            title={t('subscription.allTariffsPurchased', 'Все тарифы подключены')}
            text={t(
              'subscription.allTariffsPurchasedDesc',
              'Вы уже приобрели все доступные тарифы. Продлить подписку можно на странице тарифа.',
            )}
            action={
              <Button onClick={() => navigate('/subscriptions')}>
                {t('subscription.backToList', 'Мои подписки')}
              </Button>
            }
          />
        )}
      <div className="space-y-3">
        {[...tariffs]
          .filter((tariff) => {
            // In multi-tariff mode: hide already purchased tariffs
            if (isMultiTariff && tariff.is_purchased) return false;
            if (subscription?.is_trial && tariff.name.toLowerCase().includes('trial')) {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            const aIsCurrent = a.is_current || a.id === subscription?.tariff_id;
            const bIsCurrent = b.is_current || b.id === subscription?.tariff_id;
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return 0;
          })
          .map((tariff) => {
            const isCurrentTariff = tariff.is_current || tariff.id === subscription?.tariff_id;
            // Ветвление кнопки живёт в tariffAction(): витрин стало две
            // (обычная и простая), и расхождение в этом условии списало бы с
            // части людей не ту сумму.
            const action = tariffAction({
              tariff,
              subscription,
              purchaseOptions,
              isTariffsMode,
              isMultiTariff,
              subscriptionId,
            });

            const fact = (icon: ReactNode, text: ReactNode) => (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-dark-800/60 px-2.5 py-1 text-[13px] text-dark-300">
                {icon}
                {text}
              </span>
            );

            const price = (() => {
              const promoDaily = dailyPriceQuote(tariff, applyPromoDiscount);
              if (promoDaily) {
                return {
                  prefix: null,
                  value: formatPrice(promoDaily.price),
                  suffix: t('subscription.tariff.perDay'),
                  original:
                    promoDaily.original && promoDaily.original > promoDaily.price
                      ? formatPrice(promoDaily.original)
                      : null,
                  percent: promoDaily.percent,
                  isPromoGroup: promoDaily.isPromoGroup,
                };
              }
              if (tariff.periods.length > 0) {
                const firstPeriod = tariff.periods[0];
                const promoPeriod = applyPromoDiscount(
                  firstPeriod?.price_kopeks || 0,
                  firstPeriod?.original_price_kopeks,
                );
                return {
                  prefix: t('subscription.from'),
                  value: formatPrice(promoPeriod.price),
                  suffix: null,
                  original:
                    promoPeriod.original && promoPeriod.original > promoPeriod.price
                      ? formatPrice(promoPeriod.original)
                      : null,
                  percent: promoPeriod.percent,
                  isPromoGroup: promoPeriod.isPromoGroup,
                };
              }
              return null;
            })();

            return (
              <div
                key={tariff.id}
                data-tariff-card
                className={cn(
                  'rounded-3xl bg-dark-900/70 p-4 ring-1 ring-inset ring-dark-800/80 sm:p-5',
                  isCurrentTariff
                    ? 'ring-2 ring-accent-500'
                    : // Текущий тариф важнее подсказки: две «активные» рамки
                      // сразу не дают понять, что именно сейчас куплено.
                      tariff.is_highlighted && bestValueFrame(false),
                )}
              >
                {tariff.is_highlighted && !isCurrentTariff && <BestValueBadge className="mb-2" />}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[17px] font-bold tracking-tight text-dark-50">
                      {tariff.name}
                    </h3>
                    {tariff.description && (
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-snug text-dark-400">
                        {tariff.description}
                      </p>
                    )}
                  </div>
                  {isCurrentTariff && <Chip tone="success">{t('subscription.currentTariff')}</Chip>}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {fact(
                    <PiChartPieSliceDuotone className="h-4 w-4 text-accent-400" />,
                    tariffTrafficLabel(tariff.traffic_limit_gb, t),
                  )}
                  {fact(
                    <PiDevicesDuotone className="h-4 w-4 text-accent-400" />,
                    tariff.device_limit === 0
                      ? '∞'
                      : t('subscription.devices', { count: tariff.device_limit }),
                  )}
                  {tariff.traffic_reset_mode &&
                    tariff.traffic_reset_mode !== 'NO_RESET' &&
                    fact(
                      <PiArrowsClockwiseDuotone className="h-4 w-4 text-accent-400" />,
                      t(`subscription.trafficReset.${tariff.traffic_reset_mode}`),
                    )}
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    {price ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          {price.prefix && (
                            <span className="text-[13px] text-dark-400">{price.prefix}</span>
                          )}
                          <span className="whitespace-nowrap text-[26px] font-bold leading-tight tracking-tight text-dark-50">
                            {price.value}
                          </span>
                          {price.suffix && (
                            <span className="text-[13px] text-dark-400">{price.suffix}</span>
                          )}
                        </div>
                        {(price.original || (price.percent != null && price.percent > 0)) && (
                          <div className="mt-0.5 flex items-center gap-2">
                            {price.original && (
                              <span className="text-[13px] text-dark-500 line-through">
                                {price.original}
                              </span>
                            )}
                            {price.percent != null && price.percent > 0 && (
                              <Chip tone={price.isPromoGroup ? 'success' : 'warning'}>
                                -{price.percent}%
                              </Chip>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[15px] font-semibold text-dark-100">
                        {t('subscription.tariff.flexiblePayment')}
                      </span>
                    )}
                  </div>

                  {action === 'current-daily' ? (
                    <span className="text-[13px] text-dark-500">
                      {t('subscription.currentTariff')}
                    </span>
                  ) : action === 'switch' ? (
                    <Button
                      tone="secondary"
                      className="h-11 px-5"
                      onClick={() => onSwitchTariff(tariff.id)}
                      aria-label={
                        switchSelection
                          ? `${tariff.name}: ${t('subscription.switchTariff.choose')}`
                          : undefined
                      }
                    >
                      {t(
                        switchSelection
                          ? 'subscription.switchTariff.choose'
                          : 'subscription.switchTariff.switch',
                      )}
                    </Button>
                  ) : (
                    <Button className="h-11 px-5" onClick={() => onSelectTariff(tariff)}>
                      {t(TARIFF_ACTION_LABEL[action])}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
