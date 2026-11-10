// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * «Назад» в шапке: на первом экране кабинета ведёт на backTo, а не в navigate(-1), который
 * там ничего не делает (человек застревал на колесе после ссылки с промокодом).
 */

vi.mock('react-i18next', async () =>
  (await import('@/components/admin/reachability/testUtils')).i18nMock(),
);
vi.mock('@/platform', () => ({ useHaptic: () => ({ impact: vi.fn() }) }));

const navigate = vi.fn();
vi.mock('react-router', async (orig) => ({
  ...(await orig<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

import { PageHeader } from './PageHeader';

function renderHeader() {
  render(
    <MemoryRouter initialEntries={['/wheel']}>
      <Routes>
        <Route path="/wheel" element={<PageHeader title="Колесо" backTo="/" />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getAllByRole('button')[0]);
}

afterEach(() => {
  cleanup();
  navigate.mockReset();
  window.history.replaceState(null, '');
});

describe('PageHeader «Назад»', () => {
  it('первый экран кабинета (idx 0) — на backTo, даже если в истории есть записи впереди', () => {
    window.history.pushState({ idx: 1 }, '');
    window.history.replaceState({ idx: 0, key: 'replaced' }, '');
    expect(window.history.length).toBeGreaterThan(1);
    renderHeader();
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('без номера записи (адрес заменён вручную) — на backTo', () => {
    window.history.replaceState(null, '');
    renderHeader();
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('есть предыдущий экран кабинета — шаг назад', () => {
    window.history.replaceState({ idx: 2 }, '');
    renderHeader();
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});
