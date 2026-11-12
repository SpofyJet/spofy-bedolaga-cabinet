// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { Tariff } from '@/types';
import { TariffPurchaseForm } from './TariffPurchaseForm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _fallback?: unknown, vars?: { amount?: string }) =>
      vars?.amount ? `${key}:${vars.amount}` : key,
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
const api = vi.hoisted(() => ({ purchaseTariff: vi.fn().mockResolvedValue({}) }));
vi.mock('@/api/subscription', () => ({ subscriptionApi: api }));

beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const tariff = {
  id: 7,
  name: 'Test',
  device_limit: 1,
  servers: [],
  traffic_limit_gb: 100,
  periods: [
    { days: 30, label: '30 days', price_kopeks: 15900 },
    { days: 90, label: '90 days', price_kopeks: 35900 },
  ],
} as unknown as Tariff;

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function mount(balanceKopeks: number) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PlatformProvider>
        <MemoryRouter initialEntries={['/subscription/purchase']}>
          <TariffPurchaseForm
            tariff={tariff}
            subscriptionId={undefined}
            balanceKopeks={balanceKopeks}
            initialPeriodDays={30}
            onBack={() => {}}
          />
          <Where />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

it('при нехватке баланса кнопка ведёт на оплату недостающей суммы и помнит тариф и срок', () => {
  mount(5000);
  const pay = screen.getByRole('button', { name: /^subscription\.v10\.payShort:/ });
  // 159 ₽ − 50 ₽ = 109 ₽
  expect(pay.textContent).toMatch(/109/);
  fireEvent.click(pay);
  expect(api.purchaseTariff).not.toHaveBeenCalled();
  const where = new URL(`http://x${screen.getByTestId('where').textContent}`);
  expect(where.pathname).toBe('/balance/top-up');
  expect(where.searchParams.get('amount')).toBe('109');
  expect(where.searchParams.get('returnTo')).toBe('/subscription/purchase?tariff=7&period=30');
});

it('когда денег хватает, кнопка покупает сразу', async () => {
  mount(20000);
  fireEvent.click(screen.getByRole('button', { name: /^subscription\.v10\.buyFor/ }));
  await waitFor(() => expect(api.purchaseTariff).toHaveBeenCalledTimes(1));
  expect(api.purchaseTariff.mock.calls[0].slice(0, 2)).toEqual([7, 30]);
  expect(screen.getByTestId('where').textContent).not.toContain('/balance/top-up');
});
