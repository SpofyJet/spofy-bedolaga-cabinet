// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import ruLocale from '@/locales/ru.json';
import type { RenewalOption } from '@/types';

/**
 * Выделение выгодного: период внутри тарифа и сам тариф в списке.
 *
 * Механизма не было вовсе: клиент видел одинаковые строки и брал самую дешёвую,
 * хотя оператору выгоднее длинный период. Тесты держат само выделение и его
 * приоритет: выбранный вариант важнее подсказки, иначе на экране две «активные»
 * карточки и непонятно, что именно сейчас купят.
 */

function ru(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
  if (typeof value !== 'string') throw new Error(`нет строки ${key}`);
  return value;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, options?: Record<string, unknown>) => {
      const opts = typeof fallback === 'object' && fallback !== null ? fallback : options;
      let template: string;
      try {
        template = ru(key);
      } catch {
        template = typeof fallback === 'string' ? fallback : key;
      }
      return template.replace(/{{(\w+)}}/g, (_m, name) => String((opts as never)?.[name] ?? ''));
    },
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const state = { options: [] as RenewalOption[] };

vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getRenewalOptions: () => Promise.resolve(state.options),
    getSubscription: () => Promise.resolve({ subscription: { id: 42, tariff_name: 'Базовый' } }),
    getPurchaseOptions: () => Promise.resolve({ balance_kopeks: 1_000_000 }),
    renewSubscription: () => Promise.resolve({}),
  },
}));

const option = (overrides: Partial<RenewalOption>): RenewalOption => ({
  period_days: 30,
  price_kopeks: 60000,
  price_rubles: 600,
  discount_percent: 0,
  original_price_kopeks: null,
  ...overrides,
});

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  state.options = [];
});

async function renderRenew() {
  const Renew = (await import('@/pages/RenewSubscription')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/subscriptions/42/renew']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId/renew" element={<Renew />} />
          </Routes>
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

/** Карточка периода — ближайшая кнопка вокруг подписи с числом дней. */
const PERIOD_LABEL: Record<number, string> = { 30: '1 месяц', 180: '6 месяцев', 360: '12 месяцев' };

function cardFor(days: number): HTMLElement {
  const label = screen.getByText(PERIOD_LABEL[days]);
  const card = label.closest('button');
  if (!card) throw new Error(`не нашёл карточку периода ${days}`);
  return card;
}

describe('выделенный период при продлении', () => {
  it('отмечен подписью, а остальные — нет', async () => {
    state.options = [
      option({ period_days: 30 }),
      option({ period_days: 180, price_kopeks: 270000, is_highlighted: true }),
    ];
    await renderRenew();

    const badges = await screen.findAllByText(ru('subscription.bestValue'));
    expect(badges).toHaveLength(1);
    expect(cardFor(180).contains(badges[0])).toBe(true);
  });

  it('выделен заливкой и подписан — и когда выбран, и когда нет', async () => {
    state.options = [
      option({ period_days: 30 }),
      option({ period_days: 180, price_kopeks: 270000, is_highlighted: true }),
    ];
    await renderRenew();
    await screen.findByText(ru('subscription.bestValue'));

    expect(cardFor(180).className).toContain('bg-accent-500/15');
    expect(cardFor(30).className).not.toContain('bg-accent-500/15');

    // Человек ушёл на другой период: заливка переходит к выбору, плашка остаётся.
    fireEvent.click(cardFor(30));
    expect(cardFor(30).className).toContain('bg-accent-500/15');
    expect(cardFor(180).textContent).toContain(ru('subscription.bestValue'));
  });

  it('ничего не выделяет, когда оператор не выбрал период', async () => {
    state.options = [option({ period_days: 30 }), option({ period_days: 180 })];
    await renderRenew();
    await screen.findByText('1 месяц');

    expect(screen.queryByText(ru('subscription.bestValue'))).toBeNull();
  });

  it('не спорит со скидкой: обе отметки видны одновременно', async () => {
    state.options = [
      option({
        period_days: 180,
        price_kopeks: 270000,
        discount_percent: 25,
        original_price_kopeks: 360000,
        is_highlighted: true,
      }),
    ];
    await renderRenew();

    expect(await screen.findByText(ru('subscription.bestValue'))).toBeTruthy();
    expect(screen.getByText('-25%')).toBeTruthy();
  });
});

// ==================== отметка и главная кнопка в списке тарифов ====================

const CATALOG = [
  { id: 2, name: 'Стандартный' },
  { id: 3, name: 'С Обходами' },
  { id: 4, name: 'ULTIMA' },
];

/** Карточки с залитой кнопкой: на экране она должна быть одна. */
const primaryCards = () => Array.from(document.querySelectorAll('[data-tariff-primary]'));

describe('отмеченный тариф в списке', () => {
  it('отмечен «Советуем», остальные — нет', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid([
      { id: 1, name: 'Базовый', is_highlighted: false },
      { id: 2, name: 'Про', is_highlighted: true },
    ]);

    const badges = await screen.findAllByText(ru('subscription.recommended'));
    expect(badges).toHaveLength(1);
    expect(tariffCard('Про').contains(badges[0])).toBe(true);
    // «Выгодно» — слово для срока: у тарифа подороже оно было бы неправдой.
    expect(screen.queryByText(ru('subscription.bestValue'))).toBeNull();
  });

  it('без отметки оператора «Советуем» стоит на тарифе с обходами', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid(CATALOG);

    const badges = await screen.findAllByText(ru('subscription.recommended'));
    expect(badges).toHaveLength(1);
    expect(tariffCard('С Обходами').contains(badges[0])).toBe(true);
  });

  it('отметка оператора важнее встроенной: двух «Советуем» не бывает', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid([
      { id: 2, name: 'Стандартный', is_highlighted: true },
      { id: 3, name: 'С Обходами' },
    ]);

    const badges = await screen.findAllByText(ru('subscription.recommended'));
    expect(badges).toHaveLength(1);
    expect(tariffCard('Стандартный').contains(badges[0])).toBe(true);
  });

  it('единственному тарифу советовать нечего', async () => {
    const { render: renderGrid } = await import('./tariffGridHarness');
    renderGrid([{ id: 3, name: 'С Обходами' }]);

    await screen.findByText('С Обходами');
    expect(screen.queryByText(ru('subscription.recommended'))).toBeNull();
  });

  it('текущий тариф важнее подсказки: двух выделений сразу не бывает', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid([{ id: 2, name: 'Про', is_highlighted: true }], { currentTariffId: 2 });

    expect(screen.queryByText(ru('subscription.recommended'))).toBeNull();
    // Текущий выделен заливкой, отметки на нём нет.
    expect(tariffCard('Про').className).toContain('bg-accent-500/15');
  });
});

describe('главная кнопка в списке тарифов', () => {
  it('у кого тарифа ещё нет — на отмеченном тарифе, и она одна', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid(CATALOG);
    await screen.findByText('С Обходами');

    expect(primaryCards()).toEqual([tariffCard('С Обходами')]);
    expect(tariffCard('С Обходами').className).toContain('bg-accent-500/15');
    expect(tariffCard('Стандартный').className).not.toContain('bg-accent-500/15');
    // У остальных то же действие, но текстом: тариф выбрать можно любой.
    expect(screen.getAllByRole('button', { name: ru('subscription.choose') })).toHaveLength(3);
  });

  it('у кого тариф есть — на своём тарифе, а не на отмеченном', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid(CATALOG, { currentTariffId: 2 });
    await screen.findByText('С Обходами');

    expect(primaryCards()).toEqual([tariffCard('Стандартный')]);
    expect(tariffCard('Стандартный').className).toContain('bg-accent-500/15');
    // Отметка остаётся подсказкой, но не перетягивает на себя ни кнопку, ни заливку.
    expect(tariffCard('С Обходами').textContent).toContain(ru('subscription.recommended'));
    expect(tariffCard('С Обходами').className).not.toContain('bg-accent-500/15');
  });

  it('без отметки и без своего тарифа — на первом в списке', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid([
      { id: 10, name: 'Первый' },
      { id: 11, name: 'Второй' },
    ]);
    await screen.findByText('Первый');

    expect(primaryCards()).toEqual([tariffCard('Первый')]);
  });

  it('вечный тариф продлевать нечем: залитой кнопки нет, выделен он сам', async () => {
    const { render: renderGrid, cardFor: tariffCard } = await import('./tariffGridHarness');
    renderGrid(CATALOG, {
      subscription: { tariff_id: 4, is_active: true, end_date: '2099-12-31T23:59:59Z' },
    });
    await screen.findByText('ULTIMA');

    expect(primaryCards()).toHaveLength(0);
    expect(tariffCard('ULTIMA').className).toContain('bg-accent-500/15');
    expect(tariffCard('С Обходами').className).not.toContain('bg-accent-500/15');
  });
});
