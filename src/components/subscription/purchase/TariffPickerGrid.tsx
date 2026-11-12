import { tariffTrafficLabel } from '../../../utils/tariffTrafficLabel';
import { useTranslation } from 'react-i18next';
import { BestValueBadge, bestValueFrame } from '../BestValueBadge';
import { useNavigate } from 'react-router';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from './dailyPrice';
import { PiCheckCircleDuotone } from 'react-icons/pi';
import { Button, Chip, EmptyState } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import type { Tariff, Subscription, PurchaseOptions } from '../../../types';
import { tariffAction, type TariffActionKind } from './tariffAction';
import { plainTariffName } from '@/utils/plainTariffName';
import { recommendedTariffId } from '@/utils/recommendedTariff';
import { isLifetimeSubscription } from '@/utils/lifetime';

/** Подпись кнопки для действий, которые ведут в один и тот же сценарий выбора. */
const TARIFF_ACTION_LABEL: Record<Exclude<TariffActionKind, 'current-daily' | 'switch'>, string> = {
  extend: 'subscription.extend',
  moveToTariff: 'subscription.cta.moveToTariff',
  // «Выбрать», а не «Купить»: дальше ещё выбор срока, деньги спишутся не здесь.
  purchase: 'subscription.choose',
};

// ──────────────────────────────────────────────────────────────────
// TariffPickerGrid
//
// The tariff selection surface inside SubscriptionPurchase. Renders:
//   (no promo-group banner: Spofy owner removed «Ваша группа: …»; group
//    discounts already show up in the prices)
//   - the "all tariffs purchased" empty state (multi-tariff mode)
//   - the list itself (12.11, compact cards): name and price in one line,
//     description under it, per-tariff CTAs differentiated by user state
//     (extend / switch / purchase / legacy renewal). Only one card carries the
//     filled button and the tint: the person's own tariff, or — when they have
//     none yet — the one marked «Советуем»; the rest offer the same action as
//     a text link, so the screen has one accent.
//
// Owns nothing — pure presentation that calls back into the parent
// for selection (`onSelectTariff`) and switch (`onSwitchTariff`).
// ──────────────────────────────────────────────────────────────────

export interface TariffPickerGridProps {
  tariffs: Tariff[];
  subscription: Subscription | null;
  purchaseOptions: PurchaseOptions | undefined;
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
  isMultiTariff,
  subscriptionId,
  switchSelection = false,
  onSelectTariff,
  onSwitchTariff,
}: TariffPickerGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatMoney } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();

  // Целые суммы без «,00»: «299 ₽», а не «299,00 ₽».
  const formatPrice = (kopeks: number) =>
    kopeks === 0 ? t('subscription.free', 'Бесплатно') : formatMoney(kopeks / 100);

  const visible = [...tariffs]
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
    .map((tariff) => ({
      tariff,
      isCurrentTariff: Boolean(tariff.is_current || tariff.id === subscription?.tariff_id),
      // Ветвление кнопки живёт в tariffAction(): витрин стало две (обычная и
      // простая), и расхождение в этом условии списало бы с части людей не ту сумму.
      action: tariffAction({
        tariff,
        subscription,
        purchaseOptions,
        isMultiTariff,
        subscriptionId,
      }),
    }));
  // Владельцу вечной подписки советовать нечего: любой другой тариф для него шаг назад.
  const recommendedId = isLifetimeSubscription(subscription)
    ? null
    : recommendedTariffId(visible.map((item) => item.tariff));
  // Залитая кнопка на экране одна. У кого тариф уже есть — на нём: за 30 дней
  // (на 12.11.2026) 1 087 оплат были продлением своего тарифа и 42 — сменой.
  // У кого тарифа ещё нет — на отмеченном «Советуем», иначе на первом в списке.
  // Вечный и суточный тарифы продлевать нечем: там залитой кнопки нет совсем.
  const current = visible.find((item) => item.isCurrentTariff);
  const primaryId = current
    ? current.action === 'current-daily'
      ? undefined
      : current.tariff.id
    : (visible.find((item) => item.tariff.id === recommendedId) ?? visible[0])?.tariff.id;
  // Подсвечена та же карточка, что с кнопкой; без кнопки — карточка своего тарифа.
  const tintedId = primaryId ?? current?.tariff.id;

  return (
    <>
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
        {visible.map(({ tariff, isCurrentTariff, action }) => {
          // У своего тарифа отметки нет: «Текущий» уже говорит о нём главное.
          const recommended = tariff.id === recommendedId && !isCurrentTariff;
          const primary = tariff.id === primaryId;

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
                // «от» — только когда сроков несколько: у единственного это и есть цена.
                prefix: tariff.periods.length > 1 ? t('subscription.from') : null,
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

          // Описание тарифа: первая строка — главное, остальные спокойнее. Без описания
          // говорим то, что знаем из самого тарифа: трафик и число устройств.
          const lines = (tariff.description ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          const facts = [
            tariffTrafficLabel(tariff.traffic_limit_gb, t),
            tariff.device_limit === 0
              ? null
              : t('subscription.devices', { count: tariff.device_limit }),
          ]
            .filter(Boolean)
            .join(' · ');

          const label =
            action === 'current-daily'
              ? null
              : action === 'switch'
                ? t(
                    switchSelection
                      ? 'subscription.switchTariff.choose'
                      : 'subscription.switchTariff.switch',
                  )
                : t(TARIFF_ACTION_LABEL[action]);
          const onAction = () =>
            action === 'switch' ? onSwitchTariff(tariff.id) : onSelectTariff(tariff);
          const ariaLabel =
            action === 'switch' && switchSelection
              ? `${plainTariffName(tariff.name)}: ${t('subscription.switchTariff.choose')}`
              : undefined;

          return (
            <div
              key={tariff.id}
              data-tariff-card
              data-tariff-primary={primary || undefined}
              className={cn(
                'rounded-3xl p-[18px]',
                // Выделение на экране одно — там же, где залитая кнопка: два
                // подсвеченных тарифа не дают понять, какой из них сейчас куплен.
                tariff.id === tintedId ? bestValueFrame(true) : 'bg-dark-900/70',
              )}
            >
              <div className="flex items-baseline gap-2.5">
                {/* Название и отметка — отдельные элементы строки с переносом: на
                    экране 360 px отметка уходит под название целиком, а не сжимает
                    его до разрыва посреди слова («Стандартны / й»). */}
                <div
                  data-tariff-title
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5"
                >
                  <h3 className="font-display text-[19px] font-bold leading-tight tracking-tight text-dark-50">
                    {plainTariffName(tariff.name)}
                  </h3>
                  {recommended && (
                    <BestValueBadge label={t('subscription.recommended', 'Советуем')} />
                  )}
                  {isCurrentTariff && <Chip tone="success">{t('subscription.currentTariff')}</Chip>}
                </div>
                {price && (
                  <span className="shrink-0 whitespace-nowrap font-display text-lg font-bold text-dark-50">
                    {price.prefix ? `${price.prefix} ` : ''}
                    {price.value}
                    {price.suffix && (
                      <span className="ml-1 text-[13px] font-medium text-dark-400">
                        {price.suffix}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {price && (price.original || (price.percent != null && price.percent > 0)) && (
                <div className="mt-1 flex items-center justify-end gap-2">
                  {price.original && (
                    <span className="text-[13px] text-dark-500 line-through">{price.original}</span>
                  )}
                  {price.percent != null && price.percent > 0 && (
                    <Chip tone={price.isPromoGroup ? 'success' : 'warning'}>-{price.percent}%</Chip>
                  )}
                </div>
              )}

              <div className="mt-2">
                {lines.length > 0 ? (
                  lines.map((line, index) => (
                    <p
                      key={index}
                      className={cn(
                        'text-sm leading-[1.45]',
                        index === 0 ? 'font-medium text-dark-50' : 'text-dark-400',
                      )}
                    >
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-sm leading-[1.45] text-dark-400">{facts}</p>
                )}
                {!price && (
                  <p className="text-sm leading-[1.45] text-dark-400">
                    {t('subscription.tariff.flexiblePayment')}
                  </p>
                )}
              </div>

              {/* текущий суточный тариф уже помечен чипом «Текущий» — кнопки нет */}
              {label === null ? null : primary ? (
                <Button
                  className="mt-3.5 h-[50px] w-full text-base"
                  onClick={onAction}
                  aria-label={ariaLabel}
                >
                  {label}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={onAction}
                  aria-label={ariaLabel}
                  className="-mb-2 mt-1 inline-flex h-11 items-center text-[15px] font-semibold text-accent-400 transition-opacity hover:opacity-80 active:opacity-70"
                >
                  {label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
