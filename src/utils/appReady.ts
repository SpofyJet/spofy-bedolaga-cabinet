import { miniAppReady } from '@telegram-apps/sdk-react';
import { getCachedFullscreenEnabled } from '../hooks/useTelegramSDK';
import { isTelegramMobile } from './qrScanner';

// rAF не срабатывает, пока WebView скрыт за заставкой Telegram, поэтому кадр ждём с потолком.
const PAINT_WAIT_MS = 200;

let signalled = false;

function tellTelegram(): void {
  try {
    miniAppReady();
  } catch {
    window.Telegram?.WebApp?.ready?.();
  }
  // Часть клиентов принимает запрос на весь экран только после ready.
  try {
    const webApp = window.Telegram?.WebApp;
    if (webApp && !webApp.isFullscreen && isTelegramMobile() && getCachedFullscreenEnabled()) {
      webApp.requestFullscreen?.();
    }
  } catch {
    // Запрос необязательный: окно просто останется развёрнутым.
  }
}

/** Убирает заставку Telegram, когда готов первый настоящий экран. Срабатывает один раз. */
export function signalAppReady(): void {
  if (signalled) return;
  signalled = true;
  let told = false;
  const once = () => {
    if (told) return;
    told = true;
    tellTelegram();
  };
  requestAnimationFrame(() => requestAnimationFrame(once));
  setTimeout(once, PAINT_WAIT_MS);
}
