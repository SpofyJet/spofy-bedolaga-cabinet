// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import ru from '@/locales/ru.json';
import type { Subscription, SubscriptionListItem } from '@/types';

/**
 * Вечная подписка (ULTIMA) на экранах: срок — «Навсегда» (не «2222 дня», не
 * «до 31.12.2099», не «осталось 26 000 дней»), и продлить её не предлагают.
 * Докупка и смена тарифа остаются.
 */

/** Ключи вечной подписки берём из настоящей русской локали — проверяем сам текст. */
function translate(key: string): string {
  let node: unknown = ru;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  return key.startsWith('subscription.lifetime.') && typeof node === 'string' ? node : key;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translate(key),
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const LIFETIME_END = '2099-12-31T23:59:59Z';

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 42,
  status: 'active',
  is_trial: false,
  start_date: '2026-11-01T00:00:00Z',
  end_date: LIFETIME_END,
  days_left: 26_355,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '26355 д.',
  traffic_limit_gb: 0,
  traffic_used_gb: 0,
  traffic_used_percent: 0,
  device_limit: 5,
  connected_squads: [],
  servers: [],
  autopay_enabled: false,
  autopay_days_before: 3,
  subscription_url: null,
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
  tariff_id: 9,
  tariff_name: 'ULTIMA',
  is_lifetime: true,
  ...overrides,
});

const listItem = (overrides: Partial<SubscriptionListItem> = {}): SubscriptionListItem => ({
  id: 42,
  status: 'active',
  tariff_id: 9,
  tariff_name: 'ULTIMA',
  traffic_limit_gb: 0,
  traffic_used_gb: 1,
  device_limit: 5,
  end_date: LIFETIME_END,
  subscription_url: null,
  subscription_crypto_link: null,
  is_trial: false,
  autopay_enabled: true,
  connected_squads: [],
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
});

describe('SubscriptionListCard: вечная подписка', () => {
  async function renderCard(sub: SubscriptionListItem) {
    const Card = (await import('./SubscriptionListCard')).default;
    render(
      <PlatformProvider>
        <MemoryRouter>
          <Card subscription={sub} onClick={() => {}} />
        </MemoryRouter>
      </PlatformProvider>,
    );
  }

  it('вместо даты 31.12.2099 — «Навсегда», автопродления нет (без is_lifetime в списке)', async () => {
    await renderCard(listItem());

    expect(await screen.findByText('Навсегда')).toBeTruthy();
    expect(screen.queryByText(/2099/)).toBeNull();
    expect(screen.queryByText('subscription.autopay')).toBeNull();
  });

  it('обычная подписка по-прежнему показывает дату и автопродление', async () => {
    await renderCard(listItem({ end_date: '2026-12-07T00:00:00Z' }));

    expect(screen.queryByText('Навсегда')).toBeNull();
    expect(await screen.findByText('subscription.autopay')).toBeTruthy();
  });
});

describe('PurchaseCTAButton: вечная подписка', () => {
  async function renderCta(sub: Subscription, isMultiTariff: boolean, isTariffsMode: boolean) {
    const Cta = (await import('./PurchaseCTAButton')).default;
    render(
      <MemoryRouter>
        <Cta subscription={sub} isMultiTariff={isMultiTariff} isTariffsMode={isTariffsMode} />
      </MemoryRouter>,
    );
  }

  it('в тарифах — только смена тарифа, без «Продлить»', async () => {
    await renderCta(subscription(), true, true);

    expect(screen.queryByText('subscription.extend')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'subscription.switchTariff.title' }).getAttribute('href'),
    ).toBe('/subscription/purchase?subscriptionId=42');
  });

  it.each([
    [false, false],
    [true, false],
  ])('без смены тарифа (мульти=%s) кнопки продления нет вовсе', async (multi, tariffs) => {
    await renderCta(subscription(), multi, tariffs);

    expect(screen.queryByText('subscription.extend')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('обычная подписка с тарифом по-прежнему предлагает продление', async () => {
    await renderCta(
      subscription({ end_date: '2026-12-07T00:00:00Z', days_left: 34, is_lifetime: false }),
      true,
      true,
    );
    expect(screen.getByRole('link', { name: 'subscription.extend' })).toBeTruthy();
  });
});

describe('главная: InfoCards и QuickActions', () => {
  it('карточка подписки — «Навсегда» без счётчика дней и даты', async () => {
    const InfoCards = (await import('../dashboard/InfoCards')).default;
    render(
      <MemoryRouter>
        <InfoCards
          status="active"
          daysLeft={26_355}
          endDate={LIFETIME_END}
          isLifetime
          balanceRubles={0}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Навсегда')).toBeTruthy();
    expect(screen.queryByText('dashboard.info.subscription.daysCount')).toBeNull();
    expect(screen.queryByText('dashboard.info.subscription.until')).toBeNull();
    expect(screen.queryByText('dashboard.info.subscription.endingSoon')).toBeNull();
  });

  it('быстрые действия без «Продлить», плиток по-прежнему четыре', async () => {
    const QuickActions = (await import('../dashboard/QuickActions')).default;
    render(
      <MemoryRouter>
        <QuickActions
          state="active"
          renewTo="/subscriptions/42/renew"
          connectTo="/connection"
          lifetime
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText('dashboard.quick.renew')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(
      screen.getAllByRole('link').some((a) => a.getAttribute('href')?.includes('/renew')),
    ).toBe(false);
  });
});
