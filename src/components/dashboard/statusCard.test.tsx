// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StatusCard, { calendarDaysUntil, type StatusCardProps } from './StatusCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) =>
      typeof opts === 'object' && opts && 'count' in opts ? `${key}:${opts.count}` : key,
    i18n: { language: 'ru' },
  }),
  // formatTraffic тянет за собой i18n.ts — ему нужен этот экспорт.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// Полдень 12 ноября 2026: «сегодня / завтра / через N дней» не зависят от часа запуска.
const NOW = new Date(2026, 10, 12, 12, 0, 0);
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const PAID: StatusCardProps = {
  state: 'active',
  subscriptionId: 7,
  endDate: inDays(24),
  daysLeft: 24,
  tariffName: 'С Обходами',
  connectTo: '/connection?sub=7',
  renewTo: '/subscriptions/7/renew',
  connectedDevices: 2,
  deviceLimit: 3,
  trafficLimitGb: 100,
  trafficUsedGb: 38,
  bypassQuota: true,
  balanceRubles: 0,
};

function renderCard(props: Partial<StatusCardProps> = {}) {
  return render(
    <MemoryRouter>
      <StatusCard {...PAID} {...props} />
    </MemoryRouter>,
  );
}

const action = () => document.querySelector('[data-status-action]') as HTMLAnchorElement;
const row = (name: string) => document.querySelector(`[data-status-row="${name}"]`);
const rowNames = () =>
  [...document.querySelectorAll('[data-status-row]')].map((e) => e.getAttribute('data-status-row'));
const rowHrefs = (name: string) => {
  const el = row(name);
  if (!el) return [];
  const links = el.tagName === 'A' ? [el] : [...el.querySelectorAll('a')];
  return links.map((a) => a.getAttribute('href'));
};
const tone = () => document.querySelector('svg[data-tone]')?.getAttribute('data-tone');

describe('StatusCard: главная кнопка по состоянию', () => {
  it('оплачено: «Подключить устройство», одна акцентная кнопка, четыре строки', () => {
    renderCard();
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.working');
    expect(tone()).toBe('ok');
    expect(action().textContent).toBe('dashboard.vpn.connect');
    expect(action().getAttribute('href')).toBe('/connection?sub=7');
    expect(document.querySelectorAll('.bg-cta-500')).toHaveLength(1);
    expect(rowNames()).toEqual(['devices', 'traffic', 'subscription', 'balance']);
  });

  it('до конца 2 дня: «Продлить», строки «Подписка» с тем же действием нет', () => {
    renderCard({ endDate: inDays(2), daysLeft: 2 });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.endsIn:2');
    expect(tone()).toBe('warn');
    expect(action().textContent).toBe('dashboard.vpn.renew');
    expect(action().getAttribute('href')).toBe('/subscriptions/7/renew');
    expect(screen.getByText('dashboard.vpn.renewNote')).toBeTruthy();
    expect(rowNames()).toEqual(['devices', 'traffic', 'balance']);
  });

  it.each([
    ['сегодня', 0.2, 'dashboard.vpn.endsToday'],
    ['завтра', 1, 'dashboard.vpn.endsTomorrow'],
    ['через 3 дня', 3, 'dashboard.vpn.endsIn:3'],
  ])('заголовок по календарным дням: %s', (_name, days, title) => {
    renderCard({ endDate: inDays(days), daysLeft: Math.ceil(days) });
    expect(screen.getByRole('heading').textContent).toBe(title);
  });

  it('за 4 дня до конца — ещё обычное «VPN работает»', () => {
    renderCard({ endDate: inDays(4), daysLeft: 4 });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.working');
    expect(action().textContent).toBe('dashboard.vpn.connect');
  });

  it('закончилась: «Продлить и включить VPN», из строк только баланс', () => {
    renderCard({ state: 'expired', endDate: inDays(-3), daysLeft: 0 });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.off');
    expect(tone()).toBe('off');
    expect(action().textContent).toBe('dashboard.vpn.renewAndEnable');
    expect(action().getAttribute('href')).toBe('/subscriptions/7/renew');
    expect(screen.getByText('dashboard.vpn.paidEnded')).toBeTruthy();
    expect(screen.getByText('dashboard.vpn.expiredNote')).toBeTruthy();
    expect(rowNames()).toEqual(['balance']);
  });

  it('отключена до конца оплаченного срока: не пишем «оплата закончилась» про будущую дату', () => {
    renderCard({ state: 'expired', endDate: inDays(10), daysLeft: 10 });
    expect(screen.getByText('dashboard.vpn.paidUntil')).toBeTruthy();
    expect(screen.queryByText('dashboard.vpn.paidEnded')).toBeNull();
  });

  it('пробный закончился: «Оформить подписку» ведёт на тарифы', () => {
    renderCard({
      state: 'expired',
      trial: true,
      endDate: inDays(-1),
      daysLeft: 0,
      renewTo: '/subscription/purchase',
    });
    expect(action().textContent).toBe('dashboard.vpn.subscribe');
    expect(action().getAttribute('href')).toBe('/subscription/purchase');
    expect(screen.getByText('dashboard.vpn.trialEnded')).toBeTruthy();
    expect(screen.getByText('dashboard.vpn.trialExpiredNote')).toBeTruthy();
  });

  it('пробный, устройство подключено: «Оформить подписку»', () => {
    renderCard({
      trial: true,
      endDate: inDays(1),
      daysLeft: 1,
      connectedDevices: 1,
      trafficLimitGb: 5,
      trafficUsedGb: 1.2,
      bypassQuota: false,
    });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.working');
    expect(action().textContent).toBe('dashboard.vpn.subscribe');
    expect(action().getAttribute('href')).toBe('/subscription/purchase');
    // пробному докупку трафика не продаём, продлевать нечего
    expect(rowNames()).toEqual(['devices', 'traffic', 'balance']);
    expect(rowHrefs('traffic')).toEqual([]);
    expect(screen.queryByText('dashboard.vpn.endsTomorrow')).toBeNull();
  });

  it('пробный без устройств: «Подключить устройство», строки устройств нет — об этом уже сказано в подписи', () => {
    renderCard({ trial: true, endDate: inDays(1), daysLeft: 1, connectedDevices: 0 });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.trialRunning');
    expect(action().textContent).toBe('dashboard.vpn.connect');
    expect(action().getAttribute('href')).toBe('/connection?sub=7');
    expect(screen.getByText('dashboard.vpn.trialNoDevice')).toBeTruthy();
    expect(row('devices')).toBeNull();
  });

  it('оплачено без устройств: строка устройств остаётся — больше об этом нигде не сказано', () => {
    renderCard({ connectedDevices: 0 });
    expect(rowNames()).toContain('devices');
    expect(screen.queryByText('dashboard.vpn.manage')).toBeNull();
  });

  it('пробный, число устройств неизвестно: зовём подключить, строки устройств нет', () => {
    renderCard({ trial: true, endDate: inDays(1), daysLeft: 1, connectedDevices: undefined });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.working');
    expect(action().textContent).toBe('dashboard.vpn.connect');
    expect(row('devices')).toBeNull();
  });

  it('трафик закончился: «Докупить трафик», в строке трафика то же действие не повторяется', () => {
    renderCard({ limited: true, trafficUsedGb: 100 });
    expect(screen.getByRole('heading').textContent).toBe('subscription.trafficLimitedTitle');
    expect(tone()).toBe('warn');
    expect(action().textContent).toBe('subscription.buyTraffic');
    expect(action().getAttribute('href')).toBe('/subscriptions/7?topup=traffic');
    expect(rowHrefs('traffic')).toEqual([]);
    expect(screen.queryByText('dashboard.vpn.buyMore')).toBeNull();
  });

  it('трафик закончился у пробного: «Оформить подписку»', () => {
    renderCard({ limited: true, trial: true, trafficLimitGb: 5, trafficUsedGb: 5 });
    expect(action().textContent).toBe('dashboard.vpn.subscribe');
    expect(action().getAttribute('href')).toBe('/subscription/purchase');
  });

  it('вечная подписка: продления нигде нет', () => {
    renderCard({ lifetime: true, daysLeft: 26000, endDate: '2099-12-31T00:00:00Z' });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.working');
    expect(screen.queryByText('dashboard.vpn.renew')).toBeNull();
    expect(rowHrefs('subscription')).toEqual(['/subscription']);
  });

  it('нет подписки: «Тарифы и цены»; при доступном пробном периоде кнопка спокойная', () => {
    renderCard({ state: 'none', subscriptionId: undefined, endDate: null, quietAction: true });
    expect(screen.getByRole('heading').textContent).toBe('dashboard.info.subscription.none');
    expect(tone()).toBe('idle');
    expect(action().textContent).toBe('subscriptions.browsePlans');
    expect(action().getAttribute('href')).toBe('/subscription/purchase');
    expect(document.querySelector('.bg-cta-500')).toBeNull();
    expect(rowNames()).toEqual(['balance']);
  });

  it('пока состояние неизвестно — заглушка без ссылок', () => {
    renderCard({ loading: true });
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('StatusCard: строки', () => {
  it('строка ведёт к подробностям, надпись справа — к действию', () => {
    renderCard();
    expect(rowHrefs('devices')).toEqual(['/subscription?section=devices']);
    expect(rowHrefs('traffic')).toEqual(['/subscriptions/7?topup=traffic']);
    expect(rowHrefs('subscription')).toEqual(['/subscription', '/subscriptions/7/renew']);
    expect(rowHrefs('balance')).toEqual(['/balance', '/balance/top-up']);
  });

  it('все места заняты — предупреждение вместо «подключено»', () => {
    renderCard({ connectedDevices: 3 });
    expect(screen.getByText('dashboard.devicesTraffic.allSlotsBusy')).toBeTruthy();
    expect(screen.queryByText('dashboard.vpn.connected')).toBeNull();
  });

  it('безлимитный трафик: строки трафика нет', () => {
    renderCard({ trafficLimitGb: 0, bypassQuota: false });
    expect(rowNames()).toEqual(['devices', 'subscription', 'balance']);
  });

  it('обычный лимит — «Трафик», квота обходов — «Трафик обходов»', () => {
    renderCard({ bypassQuota: false });
    expect(screen.getByText('dashboard.vpn.traffic')).toBeTruthy();
    cleanup();
    renderCard({ bypassQuota: true });
    expect(screen.getByText('dashboard.vpn.bypassTraffic')).toBeTruthy();
  });

  it('обходы выключены: подпись и подсказка, «Докупить» остаётся', () => {
    renderCard({ bypassSuspended: true, trafficUsedGb: 100 });
    expect(screen.getByText('dashboard.devicesTraffic.bypassOff')).toBeTruthy();
    expect(screen.getByText('dashboard.devicesTraffic.bypassOffHint')).toBeTruthy();
    expect(rowHrefs('traffic')).toEqual(['/subscriptions/7?topup=traffic']);
    // обычные серверы работают — статус не меняется
    expect(screen.getByRole('heading').textContent).toBe('dashboard.vpn.working');
  });

  it('старая подписка без тарифа: в строке «Выбрать тариф»', () => {
    renderCard({ needsTariff: true, tariffName: null });
    expect(screen.getByText('subscription.legacy.noTariff')).toBeTruthy();
    expect(screen.getByText('subscription.chooseTariff')).toBeTruthy();
    expect(screen.queryByText('dashboard.vpn.renew')).toBeNull();
  });

  it('баланс: целые рубли, доля с друзей не больше самого баланса', () => {
    renderCard({ balanceRubles: 1250.9, fromFriendsRubles: 300 });
    expect(row('balance')?.textContent).toContain('1 250 ₽');
    expect(screen.getByText('dashboard.info.balance.fromFriends')).toBeTruthy();
    cleanup();
    renderCard({ balanceRubles: 0, fromFriendsRubles: 300 });
    expect(screen.queryByText('dashboard.info.balance.fromFriends')).toBeNull();
  });
});

describe('StatusCard: даты', () => {
  it('календарные дни: сегодня 0, завтра 1, вчера −1', () => {
    expect(calendarDaysUntil(new Date(2026, 10, 12, 23, 30).toISOString())).toBe(0);
    expect(calendarDaysUntil(new Date(2026, 10, 13, 0, 30).toISOString())).toBe(1);
    expect(calendarDaysUntil(new Date(2026, 10, 11, 9, 0).toISOString())).toBe(-1);
    expect(calendarDaysUntil(undefined)).toBeNull();
  });
});
