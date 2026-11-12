// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ruLocale from '@/locales/ru.json';
import type { RenewalOption } from '@/types';

/**
 * Выгодный период выбирается сразу, а не первый по счёту.
 *
 * Выделение оператора было только подсказкой: экран обводил выгодный период
 * рамкой, но выбранным держал первый — клиент видел «-45%» на годовом, а внизу
 * «К оплате» за месяц и жаловался, что кнопка покупает не то.
 *
 * Без отметки оператора в покупке выбран первый срок, в продлении — 3 месяца,
 * а если такого нет, первый.
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

vi.mock('@/api/currency', () => ({
  currencyApi: { getExchangeRates: () => Promise.resolve({ USD: 100, CNY: 14, IRR: 0.0024 }) },
}));

vi.mock('@/api/promo', () => ({
  promoApi: { getActiveDiscount: () => Promise.resolve(null) },
}));

const option = (overrides: Partial<RenewalOption>): RenewalOption => ({
  period_days: 30,
  price_kopeks: 39900,
  price_rubles: 399,
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

// Признак выбора у покупки — заливка accent; рамка выбранного варианта
// остаётся жёлтой, если оператор отметил его выгодным.
const SELECTED = 'bg-accent-500/15';
const BEST_VALUE_RING = 'bg-accent-500/15';
// Продление: выбор — заливка accent и внутреннее кольцо, выгода — жёлтая рамка.
const SELECTED_RING = 'bg-accent-500/15';

// ==================== покупка тарифа ====================

describe('покупка: выбранный по умолчанию период', () => {
  it('выгодный период выбран сразу, а не первый по счёту', async () => {
    const harness = await import('./purchase/tariffPurchaseHarness');
    harness.render([
      harness.period({ days: 30, label: '1 месяц' }),
      harness.period({ days: 360, label: '12 месяцев', is_highlighted: true }),
    ]);

    expect(harness.cardFor('12 месяцев').className).toContain(SELECTED);
    expect(harness.cardFor('1 месяц').className).not.toContain(SELECTED);
  });

  it('без отметки оператора остаётся первый по счёту', async () => {
    const harness = await import('./purchase/tariffPurchaseHarness');
    harness.render([
      harness.period({ days: 30, label: '1 месяц' }),
      harness.period({ days: 360, label: '12 месяцев' }),
    ]);

    expect(harness.cardFor('1 месяц').className).toContain(SELECTED);
    expect(harness.cardFor('12 месяцев').className).not.toContain(SELECTED);
  });

  it('выбранный выгодный период сохраняет жёлтый контур: выбран И выгоден', async () => {
    const harness = await import('./purchase/tariffPurchaseHarness');
    harness.render([
      harness.period({ days: 30, label: '1 месяц' }),
      harness.period({ days: 360, label: '12 месяцев', is_highlighted: true }),
    ]);

    const card = harness.cardFor('12 месяцев');
    expect(card.className).toContain(BEST_VALUE_RING);
    expect(card.className).toContain(SELECTED);
  });

  it('итог внизу считает выбранный выгодный период, а не первый', async () => {
    const harness = await import('./purchase/tariffPurchaseHarness');
    harness.render([
      harness.period({ days: 30, label: '1 месяц', price_kopeks: 39900 }),
      harness.period({
        days: 360,
        label: '12 месяцев',
        price_kopeks: 264000,
        is_highlighted: true,
      }),
    ]);

    // Отдельной строки «Период: …» у одного срока без добавок больше нет: срок выбран
    // в списке, сумма — на прижатой кнопке. Она и должна быть за 12 месяцев.
    const payBar = document.querySelector('[data-pay-bar]');
    expect(payBar?.textContent).toMatch(/2[\s,.]?640/);
    expect(payBar?.textContent).not.toMatch(/399/);
  });
});

// ==================== продление ====================

describe('продление: выбранный по умолчанию период', () => {
  it('выгодный период выбран сразу', async () => {
    state.options = [
      option({ period_days: 30 }),
      option({ period_days: 360, price_kopeks: 264000, is_highlighted: true }),
    ];
    const { renderRenew, cardFor } = await import('./renewHarness');
    await renderRenew();
    await screen.findByText(ru('subscription.bestValue'));

    // Рамка выбранного выгодного остаётся на месте, выбор виден заливкой и
    // внутренним контуром — обе метки сразу.
    expect(cardFor(360).className).toContain(BEST_VALUE_RING);
    expect(cardFor(360).className).toContain(SELECTED);
    expect(cardFor(360).className).toContain(SELECTED_RING);
    expect(cardFor(30).className).not.toContain(SELECTED);
  });

  it('без отметки оператора выбран первый срок: кнопка оплаты не ждёт лишнего нажатия', async () => {
    state.options = [option({ period_days: 30 }), option({ period_days: 360 })];
    const { renderRenew, cardFor } = await import('./renewHarness');
    await renderRenew();
    await screen.findByText('1 месяц');

    expect(cardFor(30).className).toContain(SELECTED);
    expect(cardFor(360).className).not.toContain(SELECTED);
  });
});
