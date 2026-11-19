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
    t: (key: string, fallback?: unknown, vars?: { amount?: string; count?: number }) => {
      const v = (typeof fallback === 'object' ? fallback : vars) as
        | { amount?: string; count?: number }
        | undefined;
      return v?.amount ? `${key}:${v.amount}` : v?.count ? `${key}:${v.count}` : key;
    },
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

const options = [
  { devices: 3, included: true, price_kopeks: 31000 },
  { devices: 5, included: false, price_kopeks: 42800 },
  { devices: 7, included: false, price_kopeks: 54600 },
  { devices: 10, included: false, price_kopeks: 72300 },
];

const tariff = {
  id: 2,
  name: 'Test',
  device_limit: 3,
  servers: [],
  traffic_limit_gb: 0,
  periods: [
    { days: 14, label: '14 days', price_kopeks: 15900 },
    { days: 30, label: '30 days', price_kopeks: 31000, device_options: options },
  ],
} as unknown as Tariff;

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function mount(balanceKopeks: number, initialPeriodDays = 30) {
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
            initialPeriodDays={initialPeriodDays}
            onBack={() => {}}
          />
          <Where />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

const rows = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[data-device-option]')).map((b) => [
    Number(b.dataset.deviceOption),
    b.textContent,
  ]);

it('шаг устройств: выгодные сверху с ценой, включённые в тариф внизу без цены', () => {
  mount(100000);
  expect(rows().map(([n]) => n)).toEqual([5, 7, 10, 3]);
  expect(rows()[3][1]).not.toMatch(/₽/);
  expect(rows()[0][1]).toMatch(/428/);
});

it('пока число устройств не выбрано, купить нельзя; выбор уходит в покупку', async () => {
  mount(100000);
  const cta = screen.getByRole('button', { name: 'subscription.v10.chooseDevices' });
  expect((cta as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(document.querySelector('[data-device-option="5"]') as HTMLElement);
  fireEvent.click(screen.getByRole('button', { name: /^subscription\.v10\.buyFor/ }));
  await waitFor(() => expect(api.purchaseTariff).toHaveBeenCalledTimes(1));
  const call = api.purchaseTariff.mock.calls[0];
  expect([call[0], call[1], call[5]]).toEqual([2, 30, 5]);
});

it('при нехватке денег выбранное число устройств возвращается вместе со сроком', () => {
  mount(5000);
  fireEvent.click(document.querySelector('[data-device-option="7"]') as HTMLElement);
  fireEvent.click(screen.getByRole('button', { name: /^subscription\.v10\.payShort:/ }));
  const where = new URL(`http://x${screen.getByTestId('where').textContent}`);
  expect(where.searchParams.get('returnTo')).toBe(
    '/subscription/purchase?tariff=2&period=30&devices=7',
  );
});

it('на 14 днях шага нет — покупка сразу с местами тарифа', async () => {
  mount(100000, 14);
  expect(document.querySelector('[data-device-step]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^subscription\.v10\.buyFor/ }));
  await waitFor(() => expect(api.purchaseTariff).toHaveBeenCalledTimes(1));
  expect(api.purchaseTariff.mock.calls[0][5]).toBeUndefined();
});
