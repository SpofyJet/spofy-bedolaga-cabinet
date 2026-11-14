import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '@/components/Toast';
import ruLocale from '@/locales/ru.json';
import { PlatformProvider } from '@/platform/PlatformProvider';

/** Общая обвязка тестов компонентов: настоящая ru.json, провайдеры платформы, запросов и роутера. */

/** Строка русской локали по ключу — тесты читают настоящие тексты, а не ключи. */
export function resolveRu(key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
  return typeof value === 'string' ? value : undefined;
}

/** Плюральная форма ru для i18next: _one / _few / _many. */
function ruPlural(count: number): 'one' | 'few' | 'many' {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}

/** Фабрика для `vi.mock('react-i18next', ...)`: строки из ru.json, плейсхолдеры подставляются. */
export function i18nMock() {
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown> | string) => {
        const opts = typeof options === 'string' ? { defaultValue: options } : (options ?? {});
        const plural =
          typeof opts.count === 'number' ? resolveRu(`${key}_${ruPlural(opts.count)}`) : undefined;
        const template =
          plural ?? resolveRu(key) ?? (opts.defaultValue as string | undefined) ?? key;
        return template.replace(/{{(\w+)}}/g, (_m, name) => String(opts[name] ?? ''));
      },
      i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
    }),
    Trans: ({ children }: { children?: unknown }) => children ?? null,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
}

export function installMatchMedia(): void {
  if (typeof window.matchMedia === 'function') return;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export function renderWithProviders(node: ReactNode, path = '/admin') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <PlatformProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </PlatformProvider>,
  );
}
