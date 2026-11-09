import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { PlatformProvider } from '@/platform/PlatformProvider';

/**
 * Обвязка для тестов экрана продления.
 *
 * Отдельным файлом, а не внутри теста: vi.mock поднимается выше импортов, и моки
 * i18n и API из теста обязаны примениться раньше, чем сюда подтянется страница.
 */

export async function renderRenew() {
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

/** Как срок подписан на экране: месяцами, а не днями. */
export const PERIOD_LABEL: Record<number, string> = {
  30: '1 месяц',
  180: '6 месяцев',
  360: '12 месяцев',
};

/** Карточка периода — кнопка вокруг подписи срока. */
export function cardFor(days: number): HTMLElement {
  const label = screen.getByText(PERIOD_LABEL[days]);
  const card = label.closest('button');
  if (!card) throw new Error(`не нашёл карточку периода ${days}`);
  return card;
}
