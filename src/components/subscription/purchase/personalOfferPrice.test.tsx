// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { serverPeriodQuote } from '@/hooks/usePromoDiscount';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { PurchaseOptions, Tariff } from '@/types';
import { TariffPickerGrid } from './TariffPickerGrid';
import { TariffPurchaseForm } from './TariffPurchaseForm';

// Персональная скидка (приз колеса −15 %) уже лежит в цене срока, которую отдаёт
// бот: 370 ₽ → 314,50 ₽, столько же спишет покупка. Кабинет накладывал её второй
// раз и показывал 267,33 ₽ (−28 %): человек пополнял на 268 ₽, возвращался и пять
// раз подряд получал «не хватает» (12.11.2026).

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
vi.mock('@/api/promo', () => ({
  promoApi: {
    getActiveDiscount: () =>
      Promise.resolve({ discount_percent: 15, source: 'wheel', expires_at: null, is_active: true }),
  },
}));

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
  id: 3,
  name: 'С Обходами',
  device_limit: 5,
  extra_devices_count: 0,
  servers: [],
  traffic_limit_gb: 50,
  periods: [
    {
      days: 30,
      label: '30 дней',
      price_kopeks: 31450,
      original_price_kopeks: 37000,
      discount_percent: 15,
    },
    {
      days: 60,
      label: '60 дней',
      price_kopeks: 59075,
      original_price_kopeks: 69500,
      discount_percent: 15,
    },
  ],
} as unknown as Tariff;

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function mountForm(balanceKopeks: number) {
  const queryClient = client();
  render(
    <QueryClientProvider client={queryClient}>
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
  // Дожидаемся ответа /promo/active-discount: именно с ним цена раньше «худела».
  await waitFor(() =>
    expect(queryClient.getQueryData(['active-discount'])).toMatchObject({ is_active: true }),
  );
}

it('цена срока с персональной скидкой берётся с сервера и второй раз не уменьшается', () => {
  expect(serverPeriodQuote({ price_kopeks: 31450, original_price_kopeks: 37000 }, true)).toEqual({
    price: 31450,
    original: 37000,
    percent: 15,
    isPromoGroup: false,
  });
  // Без скидки в цене — ни зачёркнутой цены, ни процента.
  expect(serverPeriodQuote({ price_kopeks: 31000 }, true)).toEqual({
    price: 31000,
    original: null,
    percent: null,
    isPromoGroup: false,
  });
});

it('при пустом балансе зовёт оплатить ровно цену сервера — 315 ₽, а не 268 ₽', async () => {
  await mountForm(0);
  const pay = screen.getByRole('button', { name: /^subscription\.v10\.payShort:/ });
  expect(pay.textContent).toMatch(/315/);
  expect(document.body.textContent).toMatch(/314[.,]50/);
  expect(document.body.textContent).not.toMatch(/267[.,]33/);
  expect(document.body.textContent).toContain('-15%');
  expect(document.body.textContent).not.toContain('-28%');
  fireEvent.click(pay);
  const where = new URL(`http://x${screen.getByTestId('where').textContent}`);
  expect(where.pathname).toBe('/balance/top-up');
  expect(where.searchParams.get('amount')).toBe('315');
});

it('268 ₽ на балансе при цене 314,50 ₽ — доплата 47 ₽, а не покупка с отказом', async () => {
  await mountForm(26800);
  expect(screen.queryByRole('button', { name: /^subscription\.v10\.buyFor/ })).toBeNull();
  const pay = screen.getByRole('button', { name: /^subscription\.v10\.payShort:/ });
  expect(pay.textContent).toMatch(/47/);
  fireEvent.click(pay);
  expect(api.purchaseTariff).not.toHaveBeenCalled();
  expect(
    new URL(`http://x${screen.getByTestId('where').textContent}`).searchParams.get('amount'),
  ).toBe('47');
});

it('на витрине тарифов цена «от» — тоже цена сервера', async () => {
  const queryClient = client();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TariffPickerGrid
          tariffs={[tariff]}
          subscription={null}
          purchaseOptions={{ tariffs: [tariff] } as unknown as PurchaseOptions}
          isMultiTariff={false}
          onSelectTariff={() => {}}
          onSwitchTariff={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(queryClient.getQueryData(['active-discount'])).toMatchObject({ is_active: true }),
  );
  expect(document.body.textContent).toMatch(/314[.,]50/);
  expect(document.body.textContent).not.toMatch(/267[.,]33/);
  expect(document.body.textContent).toContain('-15%');
});
