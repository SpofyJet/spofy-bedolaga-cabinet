// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { formatPrice, setExchangeRates } from '../utils/format';
import { useCurrency } from './useCurrency';

const language = vi.hoisted(() => ({ value: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: language.value },
    t: () => '$',
  }),
}));
const rates = { USD: 100, CNY: 10, IRR: 0.001 };
afterEach(() => {
  cleanup();
  setExchangeRates(null);
  language.value = 'en';
});
function hook(lang = 'en') {
  language.value = lang;
  const client = new QueryClient();
  client.setQueryData(['exchange-rates'], rates);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCurrency(), { wrapper }).result;
}
it.each([
  ['ru', 50],
  ['en', 0.5],
] as const)('preserves %s conversion and inverse', (lang, expected) => {
  const result = hook(lang);
  expect(result.current.convertAmount(50)).toBe(expected);
  expect(result.current.convertToRub(expected)).toBe(50);
});
it('formats landing prices with the same conversion as the hook', () => {
  hook();
  setExchangeRates(rates);
  expect(formatPrice(5000, 'en')).toBe('$0.50');
});
