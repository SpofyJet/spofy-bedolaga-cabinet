// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import RenewSubscription from './RenewSubscription';

// Пока баланс не пришёл (или запрос упал), он считался нулём: человеку с 1000 ₽ на
// балансе кнопка предлагала «Оплатить 310 ₽». Проверено на стенде с задержкой ответа.

const api = vi.hoisted(() => ({
  getRenewalOptions: vi.fn(),
  getPurchaseOptions: vi.fn(),
  renewSubscription: vi.fn(),
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
    getRenewalOptions: api.getRenewalOptions,
    getPurchaseOptions: api.getPurchaseOptions,
    renewSubscription: api.renewSubscription,
  },
}));

beforeEach(() => {
  api.getRenewalOptions.mockResolvedValue([
    { period_days: 30, price_kopeks: 31000, price_rubles: 310, discount_percent: 0 },
  ]);
  api.renewSubscription.mockResolvedValue({
    message: 'ok',
    new_end_date: '2027-01-06T00:00:00Z',
    amount_paid_kopeks: 31000,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mount() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PlatformProvider>
        <MemoryRouter initialEntries={['/subscriptions/77/renew?period=30']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId/renew" element={<RenewSubscription />} />
            <Route path="/subscriptions/:subscriptionId" element={<output>subscription</output>} />
          </Routes>
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}
const payButton = () => screen.queryByRole('button', { name: /^subscription\.v10\.payShort/ });
const renewButton = () => screen.queryByRole('button', { name: /^subscription\.v10\.renewFor/ });

it('пока баланс в пути, «Оплатить» не показывается; пришёл — «Продлить за»', async () => {
  let deliver: (value: unknown) => void = () => {};
  api.getPurchaseOptions.mockReturnValue(
    new Promise((resolve) => {
      deliver = resolve;
    }),
  );
  mount();
  await waitFor(() => expect(api.getRenewalOptions).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(payButton()).toBeNull();

  await act(async () => deliver({ balance_kopeks: 100000, tariffs: [] }));
  await waitFor(() => expect(renewButton()).toBeTruthy());
  expect(payButton()).toBeNull();
});

it('баланс узнать не удалось — продлеваем, а не зовём платить', async () => {
  api.getPurchaseOptions.mockRejectedValue(new Error('500'));
  mount();
  const button = await screen.findByRole('button', { name: /^subscription\.v10\.renewFor/ });
  expect(payButton()).toBeNull();

  fireEvent.click(button);
  await waitFor(() => expect(api.renewSubscription).toHaveBeenCalledWith(30, 77));
});

it('баланса не хватает — по-прежнему «Оплатить» недостающее', async () => {
  api.getPurchaseOptions.mockResolvedValue({ balance_kopeks: 10000, tariffs: [] });
  mount();
  const button = await screen.findByRole('button', { name: /^subscription\.v10\.payShort/ });
  expect(button.textContent).toMatch(/210/);
  expect(renewButton()).toBeNull();
});
