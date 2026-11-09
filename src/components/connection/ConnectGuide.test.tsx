// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig, RemnawaveAppClient } from '@/types';
import ConnectGuide, { connectablePlatforms, detectPlatform } from './ConnectGuide';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) =>
      typeof opts === 'object' && opts && 'appName' in opts
        ? `${key}:${(opts as { appName: string }).appName}`
        : key,
    i18n: { language: 'ru' },
  }),
}));

const SUB = 'https://sub.example.com/abc';
const L = (ru: string) => ({ ru, en: ru });

function app(name: string, scheme: string, featured = false): RemnawaveAppClient {
  return {
    name,
    featured,
    svgIconKey: name,
    blocks: [
      {
        title: L(`Установите ${name}`),
        description: L('Откройте магазин'),
        buttons: [{ type: 'external', link: 'https://store.example.com', text: L('Магазин') }],
      },
      {
        title: L('Добавьте подписку'),
        description: L('Нажмите кнопку'),
        buttons: [
          {
            type: 'subscriptionLink',
            link: `${scheme}{{SUBSCRIPTION_LINK}}`,
            resolvedUrl: `${scheme}${SUB}`,
            text: L('Добавить'),
          },
        ],
      },
      { title: L('Подключитесь'), description: L('Включите VPN'), buttons: [] },
    ],
  };
}

function config(): AppConfig {
  return {
    platformNames: {},
    hasSubscription: true,
    subscriptionUrl: SUB,
    hideLink: false,
    svgLibrary: { Happ: '<svg viewBox="0 0 1 1"></svg>' },
    platforms: {
      ios: {
        displayName: L('iOS'),
        apps: [
          app('Happ', 'happ://add/', true),
          app('INCY', 'incy://import/'),
          app('V2Box', 'v2box://'),
        ],
      },
      linux: { displayName: L('Linux'), apps: [app('Happ Proxy', 'happ://add/', true)] },
      windows: { displayName: L('Windows'), apps: [app('Hiddify', 'hiddify://')] },
    },
  };
}

function guide(onOpenDeepLink = vi.fn()) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  );
  render(
    <ConnectGuide
      appConfig={config()}
      isTelegramWebApp={false}
      onOpenDeepLink={onOpenDeepLink}
      copyUrl={SUB}
    />,
  );
  return onOpenDeepLink;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ConnectGuide', () => {
  it('shows only Happ and INCY; a platform without them is hidden', () => {
    const { available, appsOf } = connectablePlatforms(config());
    expect(available).toEqual(['ios', 'linux']);
    expect(appsOf('ios').map((a) => a.name)).toEqual(['Happ', 'INCY']);
    // «Happ Proxy» — тоже Happ
    expect(appsOf('linux').map((a) => a.name)).toEqual(['Happ Proxy']);
  });

  it('detects the platform from the user agent', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('windows');
  });

  it('recommends INCY first and numbers every open step', () => {
    guide();
    // устройство определилось само и названо строкой; сетка раскрывается по «Другое»
    expect(screen.queryByRole('radio', { name: 'iOS' })).toBeNull();
    expect(screen.getByText('iOS')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'subscription.connection.v10.otherDevice' }),
    );
    expect(screen.getByRole('radio', { name: 'iOS' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'iOS' }));
    expect(screen.queryByRole('radio', { name: 'iOS' })).toBeNull();
    const apps = screen.getAllByRole('radio').filter((r) => /Happ|INCY/.test(r.textContent ?? ''));
    expect(apps[0].textContent).toContain('INCY');
    expect(apps[0].getAttribute('aria-checked')).toBe('true');
    expect(apps[0].textContent).toContain('subscription.connection.featured');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Включите VPN')).toBeTruthy();
  });

  it('opens the app link and always offers copying in the add step', async () => {
    const open = guide();
    fireEvent.click(screen.getByRole('button', { name: /addToApp:INCY/ }));
    expect(open).toHaveBeenCalledWith(`incy://import/${SUB}`);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole('button', { name: 'subscription.connection.copyLink' }));
    await screen.findByText('subscription.connection.v10.copied');
    expect(writeText).toHaveBeenCalledWith(SUB);
    // шаг отмечен только после настоящего копирования
    expect(screen.getByText(/subscription.connection.v10.stepDone/)).toBeTruthy();
  });

  it('shows the link for manual copying when the phone refuses', async () => {
    guide();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false),
    });
    fireEvent.click(screen.getByRole('button', { name: 'subscription.connection.copyLink' }));
    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('textarea')?.value).toBe(SUB);
    expect(screen.queryByText(/subscription.connection.v10.stepDone/)).toBeNull();
  });
});
