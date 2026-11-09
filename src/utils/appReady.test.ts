// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('@telegram-apps/sdk-react', () => ({
  miniAppReady: () => calls.push('ready'),
}));

function stubTelegram(version = true, isFullscreen = false) {
  vi.stubGlobal('Telegram', {
    WebApp: {
      isFullscreen,
      isVersionAtLeast: () => version,
      requestFullscreen: () => calls.push('fullscreen'),
    },
  });
}

async function signal() {
  vi.resetModules();
  const { signalAppReady } = await import('./appReady');
  signalAppReady();
  await new Promise((resolve) => setTimeout(resolve, 260));
}

describe('signalAppReady', () => {
  beforeEach(() => {
    calls.length = 0;
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks for fullscreen after ready when the cached flag is empty', async () => {
    stubTelegram();
    await signal();
    expect(calls).toEqual(['ready', 'fullscreen']);
  });

  it('respects fullscreen switched off by the admin', async () => {
    stubTelegram();
    localStorage.setItem('cabinet_fullscreen_enabled', 'false');
    await signal();
    expect(calls).toEqual(['ready']);
  });

  it('skips clients without fullscreen support and windows already fullscreen', async () => {
    stubTelegram(false);
    await signal();
    expect(calls).toEqual(['ready']);
    calls.length = 0;
    stubTelegram(true, true);
    await signal();
    expect(calls).toEqual(['ready']);
  });
});
