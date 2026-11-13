// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PeriodList } from './PeriodList';

// На 360 px в строке «1 год» со скидкой «выгода» оставалась на первой строке, а сумма
// «1 402 ₽» уезжала на вторую. Теперь «выгода N ₽» и «N ₽/мес» переносятся целиком.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, vars?: { amount?: string }) =>
      vars?.amount ? fallback.replace('{{amount}}', vars.amount) : fallback,
  }),
}));
afterEach(cleanup);

it('«выгода N ₽» и цена в месяц переносятся целиком, а не посередине', () => {
  render(
    <PeriodList
      selectedDays={30}
      onSelect={() => {}}
      items={[
        { days: 30, label: '1 месяц', price: '263,50 ₽' },
        { days: 365, label: '1 год', perMonth: '145 ₽', saving: '1 402 ₽', price: '1 759,50 ₽' },
      ]}
    />,
  );
  const saving = screen.getByText('выгода 1 402 ₽');
  expect(saving.className).toContain('whitespace-nowrap');
  expect(screen.getByText('145 ₽/мес').className).toContain('whitespace-nowrap');
  // Обе части — соседи в одной строке с переносом: вторая уходит вниз целиком.
  expect(saving.parentElement?.className).toContain('flex-wrap');
});
