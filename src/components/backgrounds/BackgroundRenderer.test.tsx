// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimationConfig } from './types';

const getAnimationConfig = vi.fn<() => Promise<AnimationConfig>>();
vi.mock('@/api/branding', () => ({ brandingApi: { getAnimationConfig } }));

const { BackgroundRenderer } = await import('./BackgroundRenderer');

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BackgroundRenderer />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // jsdom без canvas: getContext → null, пятна просто не рисуются.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  getAnimationConfig.mockReset();
});

describe('BackgroundRenderer', () => {
  it('включённые «чернила» — три пятна под содержимым, с яркостью из настройки', async () => {
    getAnimationConfig.mockResolvedValue({ enabled: true, type: 'ink', opacity: 0.7 });
    mount();

    await waitFor(() => expect(document.querySelectorAll('canvas.ink-blob')).toHaveLength(3));
    const field = document.querySelector<HTMLElement>('.ink-field');
    expect(field?.getAttribute('aria-hidden')).toBe('true');
    expect(field?.style.opacity).toBe('0.7');
    // Слой под свечением темы (body::after, z-index -1) и не ловит нажатия.
    const layer = field?.parentElement;
    expect(layer?.style.zIndex).toBe('-2');
    expect(layer?.className).toContain('pointer-events-none');
  });

  it('выключен — ничего не рисует', async () => {
    getAnimationConfig.mockResolvedValue({ enabled: false, type: 'ink', opacity: 1 });
    mount();

    await waitFor(() => expect(getAnimationConfig).toHaveBeenCalled());
    expect(document.querySelector('.ink-field')).toBeNull();
  });
});
