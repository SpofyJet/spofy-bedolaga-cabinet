// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import Subscriptions from './Subscriptions';

const state = vi.hoisted(() => ({ multi: true }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
// Шапка страницы (PageHeader) даёт тактильный отклик на «Назад».
vi.mock('@/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform')>()),
  useHaptic: () => ({ impact: () => {}, notification: () => {}, selection: () => {} }),
}));
vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: String,
    currencySymbol: '₽',
    formatMoney: (v: number) => `${String(v)}\u00A0₽`,
  }),
}));
vi.mock('../api/subscription', () => ({
  subscriptionApi: {
    getSubscriptions: async () => ({ subscriptions: [], multi_tariff_enabled: state.multi }),
    getTrialInfo: async () => ({
      is_available: true,
      duration_days: 3,
      traffic_limit_gb: 10,
      device_limit: 1,
    }),
  },
}));

afterEach(cleanup);

it.each([false, true])(
  'shows the trial offer when there is no subscription (multi=%s)',
  async (multi) => {
    state.multi = multi;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Subscriptions />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'dashboard.trialOffer.freeTitle' }),
    ).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'subscription.trial.activate' })).toBeTruthy();
    expect(screen.queryByText('Тестовая')).toBeNull();
    expect(screen.queryByRole('link', { name: /Подключиться/ })).toBeNull();
    client.clear();
  },
);
