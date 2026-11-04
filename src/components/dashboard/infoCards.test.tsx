// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import InfoCards from './InfoCards';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) =>
      typeof opts === 'object' && opts && 'amount' in opts ? `${key}:${opts.amount}` : key,
    i18n: { language: 'ru' },
  }),
}));

afterEach(cleanup);

const FRIENDS = 'dashboard.info.balance.fromFriends';

function renderCards(props: Partial<Parameters<typeof InfoCards>[0]> = {}) {
  return render(
    <MemoryRouter>
      <InfoCards status="active" daysLeft={20} balanceRubles={500} {...props} />
    </MemoryRouter>,
  );
}

describe('InfoCards: «из них N ₽ с друзей»', () => {
  it('показывает долю с друзей, когда она лежит на балансе', () => {
    renderCards({ balanceRubles: 500, fromFriendsRubles: 375 });
    expect(screen.getByText(`${FRIENDS}:375`)).toBeTruthy();
  });

  it('не больше самого баланса: потраченное с друзей не показываем', () => {
    renderCards({ balanceRubles: 120.4, fromFriendsRubles: 375 });
    expect(screen.getByText(`${FRIENDS}:120`)).toBeTruthy();
  });

  it.each([
    ['баланс 0', { balanceRubles: 0, fromFriendsRubles: 375 }],
    ['с друзей 0', { balanceRubles: 500, fromFriendsRubles: 0 }],
    ['меньше рубля', { balanceRubles: 500, fromFriendsRubles: 0.5 }],
    ['баланс ещё грузится', { balanceRubles: undefined, fromFriendsRubles: 375 }],
    ['рефералка не ответила', { balanceRubles: 500, fromFriendsRubles: null }],
  ])('скрыт: %s', (_name, props) => {
    renderCards(props);
    expect(screen.queryByText(new RegExp(FRIENDS))).toBeNull();
  });
});

describe('InfoCards: без повторов действия в чипе', () => {
  it('закончилась — нет чипа «Продлить» (это главная плитка)', () => {
    renderCards({ status: 'expired', daysLeft: 0, endDate: '2026-10-01T00:00:00Z' });
    expect(screen.getByText('dashboard.info.subscription.expired')).toBeTruthy();
    expect(screen.queryByText('dashboard.info.subscription.renew')).toBeNull();
  });

  it('нет подписки — нет чипа «Выберите тариф» (это кнопка покупки ниже)', () => {
    renderCards({ status: 'none', daysLeft: undefined });
    expect(screen.getByText('dashboard.info.subscription.none')).toBeTruthy();
    expect(screen.queryByText('dashboard.info.subscription.chooseTariff')).toBeNull();
  });
});
