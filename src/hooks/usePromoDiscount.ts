import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { promoApi } from '../api/promo';

// ──────────────────────────────────────────────────────────────────
// usePromoDiscount
//
// Single source of truth for the active-discount query + the
// applyPromoDiscount helper. Extracted from SubscriptionPurchase.tsx
// so that every flow / sub-component (tariff picker, tariff purchase
// form, classic wizard, switch-tariff sheet) can call the same hook
// without re-fetching or threading a function through props.
//
// Returns:
//   activeDiscount: the raw API value (or undefined while loading)
//   applyPromoDiscount: combines the active discount with any
//     pre-existing price reduction (promo-group pricing) and reports
//     final price, original price, total percent off, and whether
//     the existing reduction is a promo-group price. Only for prices the
//     server sends WITHOUT the personal discount: daily price, custom days.
//   periodQuote: the price of a tariff period exactly as the server sent
//     it — the personal discount is already inside (see serverPeriodQuote).
// ──────────────────────────────────────────────────────────────────

export interface PromoDiscountResult {
  price: number;
  original: number | null;
  percent: number | null;
  isPromoGroup: boolean;
}

/**
 * Наложить активную скидку промокода на серверную цену (уже со скидкой группы).
 * Только для суточной цены и «своего срока»: в них сервер промокод НЕ вкладывает,
 * клиент накладывает его ровно один раз — здесь. В цену готового срока (30, 90
 * дней…) сервер вкладывает его сам — см. serverPeriodQuote ниже.
 * `existingOriginalPrice` — цена до групповой скидки, от неё считается суммарный процент.
 */
export function combinePromoDiscount(
  priceKopeks: number,
  existingOriginalPrice: number | null | undefined,
  activePercent: number,
): PromoDiscountResult {
  const hasExisting = (existingOriginalPrice ?? 0) > priceKopeks;
  const hasPromo = activePercent > 0;

  if (!hasExisting && !hasPromo) {
    return { price: priceKopeks, original: null, percent: null, isPromoGroup: false };
  }

  const percent = Math.max(0, Math.min(100, activePercent));
  const finalPrice = hasPromo
    ? priceKopeks - Math.floor((priceKopeks * percent) / 100)
    : priceKopeks;

  if (hasExisting) {
    const original = existingOriginalPrice as number;
    return {
      price: finalPrice,
      original,
      percent: Math.round((1 - finalPrice / original) * 100),
      isPromoGroup: true,
    };
  }

  return { price: finalPrice, original: priceKopeks, percent: activePercent, isPromoGroup: false };
}

export type ApplyPromoDiscount = (
  priceKopeks: number,
  existingOriginalPrice?: number | null,
) => PromoDiscountResult;

/** Срок тарифа в том виде, в каком его отдаёт purchase-options. */
export interface ServerPricedPeriod {
  price_kopeks: number;
  original_price_kopeks?: number | null;
}

/**
 * Цена срока тарифа для показа — ровно та, что пришла с сервера.
 *
 * Бот кладёт в цену срока и скидку группы, и персональную скидку человека (приз
 * колеса, промокод, предложение): purchase.py `_build_tariff_response` считает её
 * тем же расчётом, которым покупка потом списывает деньги. Накладывать активную
 * скидку здесь ещё раз нельзя — экран обещает меньше, чем спишется: при −15 %
 * показывали −28 % и «Оплатить 268 ₽» при цене 314,50 ₽, а после оплаты покупка
 * отвечала «не хватает» (12.11.2026: пять отказов подряд и второе пополнение).
 * Скидку «только на один тариф» тоже знает лишь сервер: /promo/active-discount
 * отдаёт процент без этого ограничения.
 *
 * Суточная цена и «свой срок» приходят только со скидкой группы — для них остаётся
 * combinePromoDiscount.
 */
export function serverPeriodQuote(
  period: ServerPricedPeriod,
  hasPersonalOffer: boolean,
): PromoDiscountResult {
  const price = period.price_kopeks;
  const original = period.original_price_kopeks ?? 0;
  if (original <= price) {
    return { price, original: null, percent: null, isPromoGroup: false };
  }
  return {
    price,
    original,
    percent: Math.round((1 - price / original) * 100),
    // Цвет плашки: персональная скидка — «акция», иначе это цена группы.
    isPromoGroup: !hasPersonalOffer,
  };
}

export type PeriodQuote = (period: ServerPricedPeriod) => PromoDiscountResult;

export function usePromoDiscount() {
  const { data: activeDiscount } = useQuery({
    queryKey: ['active-discount'],
    queryFn: promoApi.getActiveDiscount,
    staleTime: 30000,
  });

  const activePercent = activeDiscount?.is_active ? (activeDiscount.discount_percent ?? 0) : 0;

  const applyPromoDiscount = useCallback<ApplyPromoDiscount>(
    (priceKopeks, existingOriginalPrice) =>
      combinePromoDiscount(priceKopeks, existingOriginalPrice, activePercent),
    [activePercent],
  );

  const periodQuote = useCallback<PeriodQuote>(
    (period) => serverPeriodQuote(period, activePercent > 0),
    [activePercent],
  );

  return { activeDiscount, applyPromoDiscount, periodQuote };
}
