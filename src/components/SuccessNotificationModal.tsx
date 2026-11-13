import { isLifetimeEndDate } from '@/utils/lifetime';
/**
 * Global success notification modal.
 * Shows prominent success messages for balance top-ups and subscription purchases.
 */

import { uiLocale } from '@/utils/uiLocale';
import { formatDateOrRaw } from '@/utils/format';
import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSuccessNotification } from '../store/successNotification';
import { useCurrency } from '../hooks/useCurrency';
import { useTelegramSDK } from '../hooks/useTelegramSDK';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useHaptic } from '@/platform';
import {
  CheckCircleIcon,
  CloseIcon,
  DevicesIcon,
  RocketIcon,
  TrafficIcon,
  WalletIcon,
} from '@/components/icons';
import { plainTariffName } from '@/utils/plainTariffName';
import { Button } from '@/components/spofy/ui';
import { TONE_TILE } from '@/components/spofy/tones';
import { cn } from '@/lib/utils';

export default function SuccessNotificationModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useSuccessNotification((state) => state.isOpen);
  const data = useSuccessNotification((state) => state.data);
  const hide = useSuccessNotification((state) => state.hide);
  const { formatMoney } = useCurrency();
  const { safeAreaInset, contentSafeAreaInset, isTelegramWebApp } = useTelegramSDK();
  const haptic = useHaptic();

  const safeBottom = isTelegramWebApp
    ? Math.max(safeAreaInset.bottom, contentSafeAreaInset.bottom)
    : 0;

  const handleClose = useCallback(() => {
    hide();
  }, [hide]);

  // Esc + scroll-lock are handled by the effects below; the trap only manages focus.
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, { lockScroll: false });

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen) {
      haptic.notification('success');
    }
  }, [isOpen, haptic]);

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const isBalanceTopup = data.type === 'balance_topup';
  const isSubscription =
    data.type === 'subscription_activated' ||
    data.type === 'subscription_renewed' ||
    data.type === 'subscription_purchased';
  const isConnectionNext =
    data.type === 'subscription_activated' || data.type === 'subscription_purchased';
  const isDevicesPurchased = data.type === 'devices_purchased';
  const isTrafficPurchased = data.type === 'traffic_purchased';

  // Format amount
  const formattedAmount = data.amountKopeks ? formatMoney(data.amountKopeks / 100) : null;

  // Format new balance
  const formattedBalance =
    data.newBalanceKopeks !== undefined ? formatMoney(data.newBalanceKopeks / 100) : null;

  // Format expiry date. Вечная подписка (ULTIMA, конец в 2099-м) — «Навсегда».
  const lifetimeExpiry = isLifetimeEndDate(data.expiresAt);
  const formattedExpiry = lifetimeExpiry
    ? t('subscription.lifetime.forever')
    : formatDateOrRaw(data.expiresAt, uiLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  // Determine title and message
  let title = data.title;
  const message = data.message;
  let Icon = CheckCircleIcon;
  // Цвет плитки по смыслу: деньги и трафик — зелёный «готово», подписка и устройства — синий.
  let tone: 'success' | 'accent' = 'success';

  if (isBalanceTopup) Icon = WalletIcon;
  else if (isSubscription) {
    Icon = RocketIcon;
    tone = 'accent';
  } else if (isDevicesPurchased) {
    Icon = DevicesIcon;
    tone = 'accent';
  } else if (isTrafficPurchased) Icon = TrafficIcon;

  if (!title) {
    if (isBalanceTopup) {
      title = t('successNotification.balanceTopup.title', 'Balance topped up!');
    } else if (data.type === 'subscription_activated') {
      title = t('successNotification.subscriptionActivated.title', 'Subscription activated!');
    } else if (data.type === 'subscription_renewed') {
      title = t('successNotification.subscriptionRenewed.title', 'Subscription renewed!');
    } else if (data.type === 'subscription_purchased') {
      title = t('successNotification.subscriptionPurchased.title', 'Subscription purchased!');
    } else if (data.type === 'devices_purchased') {
      title = t('successNotification.devicesPurchased.title', 'Devices added!');
    } else if (data.type === 'traffic_purchased') {
      title = t('successNotification.trafficPurchased.title', 'Traffic added!');
    }
  }

  // Строки деталей: одна группа с разделителями, как в профиле.
  const rows: Array<{ key: string; label: string; value: string; accent?: boolean }> = [];
  if (formattedAmount) {
    // «+» и зелёный — только у пополнения: у продления и покупок это цена, а не приход.
    const plus = isBalanceTopup ? '+' : '';
    rows.push({
      key: 'amount',
      label: isBalanceTopup
        ? t('successNotification.amount', 'Amount')
        : t('successNotification.price', 'Price'),
      value: `${plus}${formattedAmount}`,
      accent: !!plus,
    });
  }
  if (isDevicesPurchased && data.devicesAdded)
    rows.push({
      key: 'devices',
      label: t('successNotification.devicesAdded', 'Devices added'),
      value: `+${data.devicesAdded}`,
      accent: true,
    });
  if (isDevicesPurchased && data.newDeviceLimit)
    rows.push({
      key: 'deviceLimit',
      label: t('successNotification.totalDevices', 'Total devices'),
      value: String(data.newDeviceLimit),
    });
  if (isTrafficPurchased && data.trafficGbAdded)
    rows.push({
      key: 'traffic',
      label: t('successNotification.trafficAdded', 'Traffic added'),
      value: `+${data.trafficGbAdded}\u00A0${t('common.units.gb', 'GB')}`,
      accent: true,
    });
  if (isTrafficPurchased && data.newTrafficLimitGb)
    rows.push({
      key: 'trafficLimit',
      label: t('successNotification.totalTraffic', 'Total traffic'),
      value: `${data.newTrafficLimitGb}\u00A0${t('common.units.gb', 'GB')}`,
    });
  if (isBalanceTopup && formattedBalance)
    rows.push({
      key: 'balance',
      label: t('successNotification.newBalance', 'New balance'),
      value: formattedBalance,
    });
  if (data.tariffName)
    rows.push({
      key: 'tariff',
      label: t('successNotification.tariff', 'Tariff'),
      value: plainTariffName(data.tariffName),
    });
  if (formattedExpiry)
    rows.push({
      key: 'expiry',
      label: lifetimeExpiry
        ? t('subscription.lifetime.term')
        : t('successNotification.validUntil', 'Valid until'),
      value: formattedExpiry,
    });

  // Продлил сам и уже на экране подписки — идти некуда, окно просто закрывается.
  const alreadyOnSubscription =
    data.type === 'subscription_renewed' && data.onSubscriptionScreen === true;

  const handleGoToSubscription = () => {
    hide();
    if (!alreadyOnSubscription) navigate('/subscriptions');
  };

  const handleGoToConnection = () => {
    hide();
    navigate('/connection');
  };

  const handleGoToBalance = () => {
    hide();
    navigate('/balance');
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-dark-950/80" onClick={handleClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        tabIndex={-1}
        className="relative mx-4 w-full max-w-sm overflow-hidden rounded-3xl bg-dark-900"
        style={{
          marginBottom: safeBottom ? `${safeBottom}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          aria-label={t('common.close')}
          className="absolute right-3 top-3 z-10 rounded-xl p-2 text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
        >
          <CloseIcon />
        </button>

        <div className="flex flex-col items-center px-6 pb-5 pt-8 text-center">
          <span
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-2xl [&>svg]:h-7 [&>svg]:w-7',
              TONE_TILE[tone],
            )}
          >
            <Icon />
          </span>
          <h2 id="success-modal-title" className="mt-4 text-xl font-bold text-dark-50">
            {title}
          </h2>
          {message && <p className="mt-1.5 text-[15px] leading-snug text-dark-400">{message}</p>}
        </div>

        <div className="space-y-4 px-4 pb-4">
          {rows.length > 0 && (
            <div className="divide-y divide-dark-700/50 overflow-hidden rounded-2xl bg-dark-800/50">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="shrink-0 text-[14px] text-dark-400">{row.label}</span>
                  <span
                    className={cn(
                      'min-w-0 truncate text-[15px] font-semibold',
                      row.accent ? 'text-success-400' : 'text-dark-100',
                    )}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {isSubscription && (
              <Button
                className="w-full"
                onClick={isConnectionNext ? handleGoToConnection : handleGoToSubscription}
              >
                {isConnectionNext
                  ? t('successNotification.connectDevice', 'Connect device')
                  : t('successNotification.goToSubscription', 'Go to Subscription')}
              </Button>
            )}
            {isBalanceTopup && (
              <Button className="w-full" onClick={handleGoToBalance}>
                {t('successNotification.goToBalance', 'Go to Balance')}
              </Button>
            )}
            {(isDevicesPurchased || isTrafficPurchased) && (
              <Button className="w-full" onClick={handleGoToSubscription}>
                {t('successNotification.goToSubscription', 'Go to Subscription')}
              </Button>
            )}
            {!alreadyOnSubscription && (
              <Button tone="secondary" className="w-full" onClick={handleClose}>
                {t('common.close', 'Close')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
