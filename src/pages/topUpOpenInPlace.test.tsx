// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Второй шаг пополнения — на месте первой кнопки. Раньше «Открыть страницу оплаты»
// появлялась ниже нажатой «Пополнить на N ₽» (на 360×640 — у самого края экрана):
// за 14 дней 21 человек из 115 нажал «Пополнить» повторно в течение 15 секунд (31 лишний
// платёж), 8 человек вторую кнопку так и не нажали.

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
        min_amount_kopeks: 100,
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
const OPEN = 'balance.openPaymentPage';

let testTime = Date.now();
beforeEach(() => {
  // Попытки разных тестов — дальше окна ограничителя частоты платежей.
  testTime += 31000;
  vi.spyOn(Date, 'now').mockReturnValue(testTime);
  localStorage.clear();
  sessionStorage.clear();
  createTopUp.mockResolvedValue({
    payment_id: '555',
    payment_url: 'https://pay.example/invoice/555',
    amount_kopeks: 31000,
    amount_rubles: 310,
    status: 'pending',
    expires_at: null,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/balance/top-up/platega_m2?amount=310']}>
        <Routes>
          <Route path="/balance/top-up/:methodId" element={<TopUpAmount />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function createPayment() {
  fireEvent.click(await screen.findByRole('button', { name: TOP_UP }));
  await screen.findByRole('button', { name: OPEN });
}

it('после создания платежа та же кнопка открывает оплату, второй «Пополнить» нет', async () => {
  renderPage();
  await createPayment();

  expect(screen.queryByRole('button', { name: TOP_UP })).toBeNull();
  expect(screen.getAllByRole('button', { name: OPEN })).toHaveLength(1);
  expect(openLink).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: OPEN }));
  expect(openLink).toHaveBeenCalledWith('https://pay.example/invoice/555');
});

it('повторные нажатия открывают ту же оплату и не создают новых платежей', async () => {
  renderPage();
  await createPayment();

  fireEvent.click(screen.getByRole('button', { name: OPEN }));
  fireEvent.click(screen.getByRole('button', { name: OPEN }));
  expect(createTopUp).toHaveBeenCalledTimes(1);
  expect(openLink).toHaveBeenCalledTimes(2);
});

it('Enter в поле суммы при готовой ссылке тоже открывает оплату', async () => {
  renderPage();
  await createPayment();

  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
  expect(createTopUp).toHaveBeenCalledTimes(1);
  expect(openLink).toHaveBeenCalledWith('https://pay.example/invoice/555');
});

it('новая сумма — снова «Пополнить»: ссылка на прежнюю сумму убирается', async () => {
  renderPage();
  await createPayment();
  expect(screen.getByText('https://pay.example/invoice/555')).toBeTruthy();

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '500' } });
  expect(screen.queryByRole('button', { name: OPEN })).toBeNull();
  expect(screen.queryByText('https://pay.example/invoice/555')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: TOP_UP }));
  await waitFor(() => expect(createTopUp).toHaveBeenCalledTimes(2));
  expect(createTopUp).toHaveBeenLastCalledWith(50000, 'platega_m2', undefined);
});

it('другая быстрая сумма — ссылка на прежнюю убирается', async () => {
  renderPage();
  await createPayment();

  fireEvent.click(screen.getByRole('button', { name: /^300/ }));
  expect(screen.queryByRole('button', { name: OPEN })).toBeNull();
  expect(screen.getByRole('button', { name: TOP_UP })).toBeTruthy();
});
