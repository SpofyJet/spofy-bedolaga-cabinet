// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';


const openLink = vi.fn();
const createTopUp = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({
    openInvoice: vi.fn(),
    openTelegramLink: vi.fn(),
    openLink,
    platform: 'telegram',
    capabilities: { hasBackButton: false },
    backButton: { show: vi.fn(), hide: vi.fn() },
  }),
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn(), selection: vi.fn() }),
}));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (v: number) => String(v),
    currencySymbol: '₽',
    formatMoney: (v: number) => `${String(v)} ₽`,
    convertAmount: (v: number) => v,
    convertToRub: (v: number) => v,
    targetCurrency: 'RUB',
  }),
}));
vi.mock('../api/balance', () => ({
  balanceApi: {
    // Как на проде: отдельная карточка способа, ссылку сразу не открываем.
    getPaymentMethods: vi.fn(async () => [
      {
        id: 'platega_m2',
        name: 'Карта / СБП',
        description: null,
        min_amount_kopeks: 5000,
        max_amount_kopeks: 5000000,
        is_available: true,
        options: null,
        quick_amounts: [10000, 30000, 50000, 150000, 500000],
        open_url_direct: false,
      },
    ]),
    createTopUp: (...args: unknown[]) => createTopUp(...args),
  },
}));

import TopUpAmount from './TopUpAmount';

const TOP_UP = /^balance\.topUp(For)?$/;

let testTime = Date.now();
beforeEach(() => {
  testTime += 31000;
  vi.spyOn(Date, 'now').mockReturnValue(testTime);
  localStorage.clear();
  sessionStorage.clear();
  createTopUp.mockResolvedValue({
    payment_id: '555',
    payment_url: 'https://pay.example/invoice/555',
    amount_kopeks: 5000,
    amount_rubles: 50,
    status: 'pending',
    expires_at: null,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderPage(amount: string) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[`/balance/top-up/platega_m2?amount=${amount}`]}>
        <Routes>
          <Route path="/balance/top-up/:methodId" element={<TopUpAmount />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('недостающая сумма меньше минимума подставляется как минимум и проходит', async () => {
  renderPage('29');
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveProperty('value', '50'));

  fireEvent.click(await screen.findByRole('button', { name: TOP_UP }));
  await waitFor(() => expect(createTopUp).toHaveBeenCalledWith(5000, 'platega_m2', undefined));
});

it('сумма не меньше минимума остаётся как есть', async () => {
  renderPage('310');
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveProperty('value', '310'));

  fireEvent.click(await screen.findByRole('button', { name: TOP_UP }));
  await waitFor(() => expect(createTopUp).toHaveBeenCalledWith(31000, 'platega_m2', undefined));
});
