// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

const RAW = "Cannot read properties of undefined (reading 'tariff')";

function Boom(): never {
  throw new Error(RAW);
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('ErrorBoundary: текст ошибки на странице', () => {
  it('в проде показывает человеческий текст, а не сообщение исключения', () => {
    vi.stubEnv('DEV', false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.queryByText(RAW)).toBeNull();
    expect(screen.getByRole('heading')).toBeTruthy();
  });

  it('в разработке сырое сообщение остаётся видно', () => {
    vi.stubEnv('DEV', true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(RAW)).toBeTruthy();
  });
});
