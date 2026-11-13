// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { navigate, haptic } = vi.hoisted(() => ({
  navigate: vi.fn(),
  haptic: { notification: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('react-router', async (orig) => ({
  ...(await orig<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (value: number) => String(value),
    currencySymbol: '₽',
    formatMoney: (v: number) => `${String(v)}\u00A0₽`,
  }),
}));
vi.mock('../hooks/useTelegramSDK', () => ({
  useTelegramSDK: () => ({
    safeAreaInset: { bottom: 0 },
    contentSafeAreaInset: { bottom: 0 },
    isTelegramWebApp: false,
  }),
}));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock('@/platform', () => ({ useHaptic: () => haptic }));

import SuccessNotificationModal from './SuccessNotificationModal';
import { useSuccessNotification } from '../store/successNotification';
import type { SuccessNotificationType } from '../store/successNotification';

function renderNotification(type: SuccessNotificationType) {
  useSuccessNotification.getState().show({ type, title: 'Done' });
  render(<SuccessNotificationModal />);
}

describe('SuccessNotificationModal next action', () => {
  afterEach(() => {
    cleanup();
    useSuccessNotification.getState().hide();
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  it.each(['subscription_activated', 'subscription_purchased'] as const)(
    'leads %s to connection',
    (type) => {
      renderNotification(type);
      fireEvent.click(screen.getByRole('button', { name: 'Connect device' }));
      expect(navigate).toHaveBeenCalledWith('/connection');
      expect(useSuccessNotification.getState().isOpen).toBe(false);
    },
  );

  it('keeps renewal on the subscription screen', () => {
    renderNotification('subscription_renewed');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Subscription' }));
    expect(navigate).toHaveBeenCalledWith('/subscriptions');
  });

  // Человек продлил сам и уже стоит на экране подписки: одна кнопка, она закрывает окно.
  it('shows one button after a manual renewal and stays where the person is', () => {
    useSuccessNotification.getState().show({
      type: 'subscription_renewed',
      title: 'Done',
      amountKopeks: 31000,
      expiresAt: '2027-01-06T00:00:00Z',
      onSubscriptionScreen: true,
    });
    render(<SuccessNotificationModal />);

    // Крестик в углу и одна кнопка действия — без второй «Закрыть».
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(document.body.textContent).toMatch(/310\s₽/);

    fireEvent.click(screen.getByRole('button', { name: 'Go to Subscription' }));
    expect(navigate).not.toHaveBeenCalled();
    expect(useSuccessNotification.getState().isOpen).toBe(false);
  });
});
