// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { PlatformProvider } from '@/platform/PlatformProvider';
import ru from '@/locales/ru.json';
import en from '@/locales/en.json';
import zh from '@/locales/zh.json';
import fa from '@/locales/fa.json';
import Balance from './Balance';

const translations = createInstance();
await translations.init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    zh: { translation: zh },
    fa: { translation: fa },
  },
  lng: 'ru',
  initAsync: false,
});
vi.mock('react-i18next', async () => ({
  ...(await vi.importActual('react-i18next')),
  useTranslation: () => ({ t: translations.t.bind(translations), i18n: translations }),
}));
vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ refreshUser: async () => {} }),
}));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({ formatAmount: String, currencySymbol: '¤' }),
}));
vi.mock('../api/balance', () => ({
  balanceApi: {
    getBalance: async () => ({ balance_kopeks: 0, balance_rubles: 0 }),
    getTransactions: async () => ({ items: [], total: 0, page: 1, per_page: 20, pages: 0 }),
    getPaymentMethods: async () => [
      {
        id: 'masked',
        name: 'Masked method',
        min_amount_kopeks: 1000,
        max_amount_kopeks: 500000,
        is_available: true,
      },
    ],
    getSavedCards: async () => ({ cards: [], recurrent_enabled: false }),
  },
}));
afterEach(cleanup);
// Spofy-адаптация: кабинет Spofy показывает границы суммы компактным форматом
// «min – max ¤» (без локализованной словесной обёртки) в карточке метода оплаты.
// Числа во всех локалях идентичны, поэтому вместо таблицы фраз — одна проверка
// на полную строку диапазона (NBSP нормализуется testing-library).
it('renders both amount bounds as a complete phrase', async () => {
  await translations.changeLanguage('ru');
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlatformProvider>
        <MemoryRouter>
          <Balance />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('10 – 5000 ¤')).toBeTruthy();
});
