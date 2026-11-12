// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({ platform: 'web', capabilities: { hasBackButton: false } }),
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn(), selection: vi.fn() }),
}));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (v: number) => String(v),
    currencySymbol: '₽',
    formatMoney: (v: number) => `${String(v)} ₽`,
    convertAmount: (v: number) => v,
    targetCurrency: 'RUB',
  }),
}));
vi.mock('../api/balance', () => ({
  balanceApi: {
    getPendingPayment: vi.fn(async () => ({ is_paid: true, status: 'paid', amount_kopeks: 72000 })),
    getLatestPayment: vi.fn(),
  },
}));
vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (state: { refreshUser: () => void }) => unknown) =>
    selector({ refreshUser: vi.fn() }),
}));

import TopUpResult from './TopUpResult';
import { saveTopUpPendingInfo } from '../utils/topUpStorage';

function Where() {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
}

function renderResult() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/balance/top-up/result']}>
        <Routes>
          <Route path="/balance/top-up/result" element={<TopUpResult />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pending = {
  amount_kopeks: 72000,
  method_id: 'platega',
  method_name: 'СБП',
  payment_id: '17001',
  created_at: Date.now(),
};

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('leads back to the checkout the user left to pay from', async () => {
  saveTopUpPendingInfo({ ...pending, return_to: '/subscriptions/77/renew?period=90' });
  renderResult();
  fireEvent.click(await screen.findByText('Продолжить оформление'));
  expect((await screen.findByTestId('where')).textContent).toBe(
    '/subscriptions/77/renew?period=90',
  );
});

it('keeps the balance buttons for a plain top-up', async () => {
  saveTopUpPendingInfo(pending);
  renderResult();
  expect(await screen.findByText('balance.topUpResult.goToBalance')).toBeTruthy();
  expect(screen.queryByText('Продолжить оформление')).toBeNull();
});

it('does not follow a return path that leaves the cabinet', async () => {
  saveTopUpPendingInfo({ ...pending, return_to: 'https://evil.example/renew' });
  renderResult();
  expect(await screen.findByText('balance.topUpResult.goToBalance')).toBeTruthy();
  expect(screen.queryByText('Продолжить оформление')).toBeNull();
});
