// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import QuickActions from './QuickActions';
import UsefulGrid from './UsefulGrid';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

describe('главная без подписки: одна главная кнопка, без дублей', () => {
  it('быстрые действия не ведут в тарифы — туда ведёт кнопка покупки', () => {
    render(
      <MemoryRouter>
        <QuickActions state="none" renewTo="/subscriptions" connectTo="/connection" />
      </MemoryRouter>,
    );
    expect(hrefs()).toEqual(['/balance/top-up', '/balance?section=promo', '/referral']);
    expect(screen.queryByText('dashboard.quick.plans')).toBeNull();
    // ни одна плитка не залита акцентом
    expect(document.querySelector('.bg-cta-500')).toBeNull();
  });

  it('с подпиской по-прежнему четыре плитки и главная — первая', () => {
    render(
      <MemoryRouter>
        <QuickActions state="active" renewTo="/subscriptions/1/renew" connectTo="/connection" />
      </MemoryRouter>,
    );
    expect(hrefs()).toHaveLength(4);
    expect(document.querySelectorAll('.bg-cta-500')).toHaveLength(1);
  });

  it('истёкший пробный период: «Купить» ведёт на тарифы, без второй плитки «Тарифы»', () => {
    render(
      <MemoryRouter>
        <QuickActions
          state="expired"
          trial
          renewTo="/subscription/purchase"
          connectTo="/connection"
        />
      </MemoryRouter>,
    );
    expect(hrefs()).toEqual([
      '/subscription/purchase',
      '/balance?section=promo',
      '/balance/top-up',
      '/referral',
    ]);
    expect(screen.getByText('dashboard.quick.buy')).toBeTruthy();
    expect(screen.queryByText('dashboard.quick.plans')).toBeNull();
  });

  it('«Полезное» не повторяет промокод, когда он уже в быстрых действиях', () => {
    render(
      <MemoryRouter>
        <UsefulGrid hidePromocode />
      </MemoryRouter>,
    );
    expect(hrefs()).not.toContain('/balance?section=promo');
    // «Инструкции» нет: её повторяет история «Как подключить»
    expect(screen.queryByText('dashboard.useful.instructions')).toBeNull();
    expect(screen.getByText('dashboard.useful.qrTv')).toBeTruthy();
  });
});
