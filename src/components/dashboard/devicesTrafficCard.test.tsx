// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DevicesTrafficCard, { trafficPair } from './DevicesTrafficCard';
import type { Device } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

const device = (i: number, platform = 'iOS') =>
  ({ hwid: `h${i}`, platform, device_model: `Device ${i}`, created_at: '' }) as unknown as Device;

const base = {
  subscriptionId: 42,
  isTrial: false,
  deviceLimit: 5,
  devices: [device(1), device(2, 'Windows')],
  connectedDevices: 2,
  trafficLimitGb: 50,
  trafficUsedGb: 12.4,
  bypassQuota: true,
  bypassSuspended: false,
};

const renderCard = (props: Partial<typeof base> = {}) =>
  render(
    <MemoryRouter>
      <DevicesTrafficCard {...base} {...props} />
    </MemoryRouter>,
  );

const linkTo = (name: string) =>
  screen.getByRole('link', { name: new RegExp(name) }).getAttribute('href');

describe('DevicesTrafficCard', () => {
  it('лимит подписан как трафик обходов, докупка ведёт на страницу подписки', () => {
    renderCard();
    expect(screen.getByText('dashboard.devicesTraffic.bypassTraffic')).toBeTruthy();
    expect(linkTo('dashboard.devicesTraffic.buyTraffic')).toBe('/subscriptions/42?topup=traffic');
    expect(linkTo('dashboard.devicesTraffic.addSlot')).toBe('/subscription?topup=devices');
  });

  it('обходы выключены — подсказка, что обычные серверы работают', () => {
    renderCard({ bypassSuspended: true, trafficUsedGb: 50 });
    expect(screen.getByText('dashboard.devicesTraffic.bypassOff')).toBeTruthy();
    expect(screen.getByText('dashboard.devicesTraffic.bypassOffHint')).toBeTruthy();
  });

  it('у пробного обе докупки ведут к выбору тарифа', () => {
    renderCard({ isTrial: true });
    expect(linkTo('dashboard.devicesTraffic.buyTraffic')).toBe('/subscription/purchase');
    expect(linkTo('dashboard.devicesTraffic.addSlot')).toBe('/subscription/purchase');
  });

  it('все места заняты — так и пишем', () => {
    renderCard({
      deviceLimit: 2,
      connectedDevices: 2,
    });
    expect(screen.getByText('dashboard.devicesTraffic.allSlotsBusy')).toBeTruthy();
  });

  it('безлимит — вместо докупки ГБ ссылка на устройства', () => {
    renderCard({ trafficLimitGb: 0 });
    expect(screen.queryByRole('link', { name: /buyTraffic/ })).toBeNull();
    expect(linkTo('dashboard.devicesTraffic.manage')).toBe('/connection?sub=42');
  });
});

describe('trafficPair', () => {
  it('убирает единицу у первого числа, только если она совпадает', () => {
    const same = trafficPair(12.4, 50);
    expect(same.limit.endsWith(same.used)).toBe(false);
    expect(same.used).not.toMatch(/ГБ|GB/);
    const mixed = trafficPair(0.5, 50);
    expect(mixed.used).toMatch(/\S+ \S+/);
  });
});
