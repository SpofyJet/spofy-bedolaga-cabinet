// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TariffPurchaseForm } from '@/components/subscription/purchase/TariffPurchaseForm';
import { PlatformProvider } from '@/platform/PlatformProvider';
import { useSuccessNotification } from '@/store/successNotification';
import type { Tariff } from '@/types';
import RenewSubscription from './RenewSubscription';

// После продления и покупки в кабинете человек видит подтверждение оплаты. Раньше экран
// подписки открывался молча: за 14 дней 9 из 87 оплативших в течение трёх минут снова
// открыли продление или покупку.

const api = vi.hoisted(() => ({
  renewSubscription: vi.fn(),
  purchaseTariff: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _fallback?: unknown, vars?: { amount?: string }) =>
      vars?.amount ? `${key}:${vars.amount}` : key,
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: String,
    currencySymbol: '₽',
    formatMoney: (v: number) => `${String(v)} ₽`,
  }),
}));
vi.mock('../hooks/usePromoDiscount', () => ({
  usePromoDiscount: () => ({
    applyPromoDiscount: (price: number) => ({ price }),
    periodQuote: (period: { price_kopeks: number }) => ({ price: period.price_kopeks }),
  }),
}));
vi.mock('../api/subscription', () => ({
  subscriptionApi: {
    getSubscription: async (id = 77) => ({
      subscription: {
        id,
        tariff_id: 3,
        tariff_name: 'С Обходами',
        is_active: true,
        is_trial: false,
        is_daily: false,
        end_date: '2026-12-07T00:00:00Z',
      },
    }),
    getRenewalOptions: async () => [
      { period_days: 30, price_kopeks: 31000, price_rubles: 310, discount_percent: 0 },
    ],
    getPurchaseOptions: async () => ({ balance_kopeks: 100000, tariffs: [] }),
    renewSubscription: api.renewSubscription,
    purchaseTariff: api.purchaseTariff,
  },
}));

beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  api.renewSubscription.mockResolvedValue({
    message: 'ok',
    new_end_date: '2027-01-06T00:00:00Z',
    amount_paid_kopeks: 31000,
  });
  api.purchaseTariff.mockResolvedValue({
    success: true,
    tariff_name: 'С Обходами',
    subscription: { id: 77, end_date: '2026-12-13T00:00:00Z' },
  });
});
afterEach(() => {
  cleanup();
  useSuccessNotification.getState().hide();
  vi.clearAllMocks();
});

function wrap(path: string, routes: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            {routes}
            <Route path="/subscriptions/:subscriptionId" element={<output>subscription</output>} />
            <Route path="/subscriptions" element={<output>subscriptions</output>} />
          </Routes>
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

it('продление: «Подписка продлена» с суммой и новой датой, человек — на экране подписки', async () => {
  wrap(
    '/subscriptions/77/renew?period=30',
    <Route path="/subscriptions/:subscriptionId/renew" element={<RenewSubscription />} />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^subscription\.v10\.renewFor/ }));

  await waitFor(() => expect(useSuccessNotification.getState().isOpen).toBe(true));
  expect(api.renewSubscription).toHaveBeenCalledWith(30, 77);
  expect(useSuccessNotification.getState().data).toEqual({
    type: 'subscription_renewed',
    amountKopeks: 31000,
    expiresAt: '2027-01-06T00:00:00Z',
    onSubscriptionScreen: true,
  });
  expect(await screen.findByText('subscription')).toBeTruthy();
});

it('отказ продления — подтверждения нет', async () => {
  api.renewSubscription.mockRejectedValue({ response: { data: { detail: 'Ошибка' } } });
  wrap(
    '/subscriptions/77/renew?period=30',
    <Route path="/subscriptions/:subscriptionId/renew" element={<RenewSubscription />} />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^subscription\.v10\.renewFor/ }));

  expect(await screen.findByText('Ошибка')).toBeTruthy();
  expect(useSuccessNotification.getState().isOpen).toBe(false);
});

it('покупка: «Подписка оплачена» с тарифом и датой — дальше «Подключить устройство»', async () => {
  const tariff = {
    id: 3,
    name: 'С Обходами',
    device_limit: 5,
    extra_devices_count: 0,
    servers: [],
    traffic_limit_gb: 50,
    periods: [{ days: 30, label: '30 дней', price_kopeks: 31000, discount_percent: 0 }],
  } as unknown as Tariff;
  wrap(
    '/subscription/purchase',
    <Route
      path="/subscription/purchase"
      element={
        <TariffPurchaseForm
          tariff={tariff}
          subscriptionId={undefined}
          balanceKopeks={100000}
          initialPeriodDays={30}
          onBack={() => {}}
        />
      }
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^subscription\.v10\.buyFor/ }));

  await waitFor(() => expect(useSuccessNotification.getState().isOpen).toBe(true));
  expect(useSuccessNotification.getState().data).toEqual({
    type: 'subscription_purchased',
    tariffName: 'С Обходами',
    expiresAt: '2026-12-13T00:00:00Z',
  });
  expect(await screen.findByText('subscriptions')).toBeTruthy();
});
