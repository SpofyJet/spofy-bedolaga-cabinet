// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { Subscription } from '@/types';

/**
 * Вёрстка карточки подписки на телефоне.
 *
 * У тарифа с длинным именем («🟡 Компания - 10 устройств») плитка «Осталось»
 * уезжала за правый край карточки: у флекс-элемента без `min-w-0` минимальная
 * ширина равна ширине неразрывного текста внутри. А десять точек-индикаторов
 * съедали 124px из 272px плитки «Подключить устройство», и заголовок ломался
 * на четыре строки.
 *
 * jsdom не считает раскладку, поэтому здесь сторожатся сами признаки:
 * ограничитель ширины у обеих плиток и вид индикатора устройств.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 42,
  status: 'active',
  is_trial: false,
  start_date: '2026-08-07T00:00:00Z',
  end_date: '2029-08-29T00:00:00Z',
  days_left: 1085,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '',
  traffic_limit_gb: 250,
  traffic_used_gb: 22.2,
  traffic_used_percent: 9,
  device_limit: 10,
  connected_squads: [],
  servers: [],
  autopay_enabled: false,
  autopay_days_before: 3,
  subscription_url: 'https://example.com/sub/abc',
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
  tariff_id: 7,
  tariff_name: '🟡 Компания - 10 устройств',
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

afterEach(cleanup);

const idleMutation = {
  mutate: () => {},
  isPending: false,
} as unknown as Parameters<
  typeof import('./SubscriptionCardActive').default
>[0]['refreshTrafficMutation'];

async function renderCard(sub: Subscription, connectedDevices = 0) {
  const Card = (await import('./SubscriptionCardActive')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/']}>
          <Card
            subscription={sub}
            trafficData={null}
            refreshTrafficMutation={idleMutation}
            trafficRefreshCooldown={0}
            connectedDevices={connectedDevices}
          />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
  return container;
}

describe('заголовок карточки', () => {
  it('имя тарифа переносится в две строки, а не обрезается в одну', async () => {
    await renderCard(subscription());

    const name = screen.getByText('🟡 Компания - 10 устройств');
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).toContain('min-w-0');
    expect(name.className).not.toContain('truncate');
  });

  it('безлимит не рисует полосу прогресса — показывает только расход', async () => {
    const container = await renderCard(
      subscription({ traffic_limit_gb: 0, traffic_used_percent: 0 }),
    );

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(screen.getByText('dashboard.unlimited')).toBeTruthy();
  });

  it('лимитный трафик показывает полосу с долей расхода', async () => {
    const container = await renderCard(subscription());

    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('9');
  });
});

describe('плитка подключения', () => {
  const dots = (container: Element) =>
    container.querySelectorAll('.h-\\[7px\\].w-\\[7px\\].rounded-full');

  it('до пяти устройств — точки по числу мест, занятые подсвечены', async () => {
    const container = await renderCard(subscription({ device_limit: 5 }), 2);

    expect(dots(container)).toHaveLength(5);
    expect(container.querySelectorAll('.h-\\[7px\\].bg-accent-400')).toHaveLength(2);
    expect(screen.getByText('dashboard.devicesOfMax')).toBeTruthy();
  });

  it('свыше пяти — только текст: точки не оставляли места заголовку', async () => {
    const container = await renderCard(subscription({ device_limit: 10 }), 3);

    expect(dots(container)).toHaveLength(0);
    expect(screen.getByText('dashboard.devicesOfMax')).toBeTruthy();
  });

  it('при исчерпанном лимите плитка помечена недоступной', async () => {
    await renderCard(subscription({ device_limit: 2 }), 2);

    const tile = screen.getByText('dashboard.connectDevice').closest('button');
    expect(tile?.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('dashboard.deviceLimitReached')).toBeTruthy();
  });
});

describe('срок и навигация', () => {
  it('тариф и срок — две отдельные плитки', async () => {
    await renderCard(subscription({ days_left: 30 }));

    const tariffTile = screen.getByText('🟡 Компания - 10 устройств').closest('a');
    expect(tariffTile?.className).toContain('spofy-tile');
    expect(tariffTile?.getAttribute('href')).toBe('/subscriptions/42');
    expect(tariffTile?.textContent).toContain('dashboard.tariff');

    const daysTile = screen.getByText('dashboard.remaining').closest('.spofy-tile');
    expect(daysTile).not.toBeNull();
    expect(daysTile).not.toBe(tariffTile);
    expect(daysTile?.textContent).toContain('30');
    expect(daysTile?.textContent).toContain('dashboard.daysUnit');
    expect(daysTile?.className).not.toContain('spofy-tile-warning');
  });

  it('последние три дня — плитка срока предупреждает', async () => {
    await renderCard(subscription({ days_left: 2 }));

    const daysTile = screen.getByText('dashboard.remaining').closest('.spofy-tile');
    expect(daysTile?.className).toContain('spofy-tile-warning');
  });

  it('многолетняя подписка — в годах, а не «6593 дня»', async () => {
    await renderCard(subscription({ days_left: 6593 }));

    const daysTile = screen.getByText('dashboard.remaining').closest('.spofy-tile');
    expect(daysTile?.textContent).toContain('18');
    expect(daysTile?.textContent).toContain('dashboard.yearsUnit');
  });

  it('последние сутки — в часах', async () => {
    await renderCard(subscription({ days_left: 0, hours_left: 5 }));

    const daysTile = screen.getByText('dashboard.remaining').closest('.spofy-tile');
    expect(daysTile?.textContent).toContain('5');
    expect(daysTile?.textContent).toContain('subscription.hours');
  });

  it('ссылка на управление подпиской подписана текстом', async () => {
    await renderCard(subscription());

    const link = screen.getByText('dashboard.viewSubscription').closest('a');
    expect(link?.getAttribute('href')).toBe('/subscriptions/42');
  });
});
