import { isAxiosError } from 'axios';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  init,
  restoreInitData,
  mountMiniApp,
  mountViewport,
  expandViewport,
  mountSwipeBehavior,
  disableVerticalSwipes,
  mountClosingBehavior,
  disableClosingConfirmation,
  mountBackButton,
  bindThemeParamsCssVars,
  bindViewportCssVars,
  requestFullscreen,
  isFullscreen,
} from '@telegram-apps/sdk-react';
import { clearStaleSessionIfNeeded } from './utils/token';
import { installEncodingSurrogateGuard } from './utils/installEncodingSurrogateGuard';
import { getTelegramInitData } from './utils/telegramInitData';
import { useAuthStore } from './store/auth';
import { AppWithNavigator } from './AppWithNavigator';
import { clearPersistedQueryCache, persistQueryCache } from './lib/queryPersist';
import { usePermissionStore } from './store/permissions';
import { signalAppReady } from './utils/appReady';
import { ErrorBoundary } from './components/ErrorBoundary';
import { brandingApi, initLogoPreload } from './api/branding';
import { checkBackendOnStartup } from './api/health';
import { getCachedFullscreenEnabled, setCachedFullscreenEnabled } from './hooks/useTelegramSDK';
import { isTelegramMobile } from './utils/qrScanner';
import { applyTelegramLanguage, i18nReady } from './i18n';
import { themeColorsQueryOptions } from './api/themeColors';
import { applyThemeColors } from './hooks/useThemeColors';
import { readThemeColorsHint } from './utils/themeColorsHint';
import { UI } from './config/constants';
import './styles/globals.css';
import { required } from '@/utils/required';

// Harden the global encoders against lone UTF-16 surrogates (truncated emoji in
// backend names/remarks) BEFORE anything renders or fetches — otherwise such a
// string crashes any encodeURI/encodeURIComponent/btoa path on iOS WebKit,
// including qrcode.react's internal encodeURI. See installEncodingSurrogateGuard.
installEncodingSurrogateGuard();

// Polyfill Object.hasOwn for older iOS/Android WebViews (Safari < 15.4, old Chrome).
// @telegram-apps/sdk v3 depends on valibot which uses Object.hasOwn internally.
// Without this, init() and any launch-params retrieval below throw
// LaunchParamsRetrieveError on affected devices.
// See: https://github.com/Telegram-Mini-Apps/tma.js/issues/683
// Тело полифила берёт hasOwnProperty из прототипа заранее: автофикс biome
// (noPrototypeBuiltins) переписывает прямой вызов на Object.hasOwn(), то есть на
// вызов самого полифила — бесконечная рекурсия и падение tsc на target ниже es2022.
const objectHasOwnProperty = Object.prototype.hasOwnProperty;
if (typeof (Object as { hasOwn?: unknown }).hasOwn !== 'function') {
  (Object as { hasOwn?: unknown }).hasOwn = (obj: object, prop: PropertyKey): boolean =>
    objectHasOwnProperty.call(obj, prop);
}

// Only initialize Telegram SDK when running inside Telegram
const isTelegramEnv =
  !!(window as unknown as Record<string, unknown>).TelegramWebviewProxy ||
  location.hash.includes('tgWebApp') ||
  location.search.includes('tgWebApp');

// Язык из клиента Telegram может отличаться от определённого по navigator, и его
// словарь тянется отдельным чанком. Точка входа ждёт и его тоже — иначе смена
// языка сразу после старта снова покажет сырые ключи.
let telegramLanguageReady: Promise<void> = Promise.resolve();

const HMR_KEY = '__tg_sdk_initialized';
const alreadyInitialized = (window as unknown as Record<string, unknown>)[HMR_KEY] === true;

if (isTelegramEnv && !alreadyInitialized) {
  (window as unknown as Record<string, unknown>)[HMR_KEY] = true;

  try {
    init();
    restoreInitData();

    if (clearStaleSessionIfNeeded(getTelegramInitData())) {
      // Zustand уже поднял прошлого пользователя из localStorage при импорте.
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isAdmin: false,
        isAdminVerified: false,
      });
      usePermissionStore.getState().reset();
      clearPersistedQueryCache();
    }

    // Adopt the user's Telegram client language on first run (no explicit choice yet).
    telegramLanguageReady = applyTelegramLanguage();

    // Each mount in its own try/catch so one failure doesn't block others.
    // mountMiniApp() internally mounts themeParams in SDK v3,
    // so we don't call mountThemeParams() separately to avoid ConcurrentCallError.
    try {
      mountMiniApp();
    } catch {}
    try {
      bindThemeParamsCssVars();
    } catch {}
    try {
      mountSwipeBehavior();
      disableVerticalSwipes();
    } catch {}
    try {
      mountClosingBehavior();
      disableClosingConfirmation();
    } catch {}
    try {
      mountBackButton();
    } catch {}
    // Viewport must be mounted before requesting fullscreen
    mountViewport()
      .then(() => {
        bindViewportCssVars();
        expandViewport();

        // На весь экран сразу при открытии (только телефон). Кэш в localStorage Telegram
        // на iPhone часто пуст, поэтому без кэша спрашиваем сервер здесь же: запрос из
        // useBranding может прийти до того, как окно смонтировано, и тихо пропасть.
        if (!isTelegramMobile()) return;
        const enter = () => {
          if (isFullscreen()) return;
          try {
            void Promise.resolve(requestFullscreen()).catch(() => {});
          } catch {}
        };
        if (getCachedFullscreenEnabled()) {
          enter();
          return;
        }
        void brandingApi.getFullscreenEnabled().then(({ enabled }) => {
          setCachedFullscreenEnabled(enabled);
          if (enabled) enter();
        });
      })
      .catch(() => {});

    // Заставку снимает первый готовый экран (AppReadySignal). Таймер страхует
    // экраны без него: логин, блокировки, ошибки.
    setTimeout(signalAppReady, UI.APP_READY_FALLBACK_MS);
  } catch {}
} else if (!isTelegramEnv) {
  // Outside Telegram — still clear stale session tokens if any
  clearStaleSessionIfNeeded(null);
}

// Bootstrap auth after the Telegram SDK is initialised so CloudStorage-backed
// refresh-token recovery can run inside initialize() (launch params + CloudStorage
// are only available post-init()).
void useAuthStore.getState().initialize();

// In parallel with auth bootstrap, eagerly check backend liveness so a dead
// backend paints the ServiceUnavailableScreen immediately instead of flashing
// the /login page first.
void checkBackendOnStartup();

if ('requestIdleCallback' in window) {
  requestIdleCallback(() => initLogoPreload());
} else {
  setTimeout(initLogoPreload, 100);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Повторяем только сбои сети и сервера: 4xx не исправится, а лишние запросы бьют по перегрузке.
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        const status = isAxiosError(error) ? error.response?.status : undefined;
        return status === undefined || status === 408 || status >= 500;
      },
      // Пауза из Retry-After с разбросом, чтобы клиенты не вернулись одной волной.
      retryDelay: (_attempt, error) => {
        const header = isAxiosError(error) ? Number(error.response?.headers?.['retry-after']) : NaN;
        const base = header > 0 ? Math.min(header, 30) * 1000 : 1000;
        return base * (0.75 + Math.random() * 0.5);
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

persistQueryCache(queryClient);

// Палитра оператора для самого первого визита: подсказки в localStorage ещё нет,
// и без ожидания первый кадр ушёл бы в цветах по умолчанию (повторные визиты
// закрывает инлайн-скрипт index.html). Ответ ставится на :root до рендера и
// попадает в подсказку. Ждём не дольше таймаута: мёртвый бэкенд не должен
// держать пустой экран, getColors на ошибке сам отдаёт дефолт.
const themeColorsReady: Promise<void> = readThemeColorsHint()
  ? Promise.resolve()
  : Promise.race([
      queryClient
        .fetchQuery(themeColorsQueryOptions())
        .then((colors) => applyThemeColors(colors))
        .catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, UI.THEME_COLORS_FIRST_PAINT_TIMEOUT_MS)),
    ]);

// Рисуем только после словарей. Локали лежат в отдельных ленивых чанках, а
// react.useSuspense выключен: без ожидания первая отрисовка на холодном кэше
// уходила с сырыми ключами (`auth.login`, `auth.email`), а ключи с инлайн-
// дефолтом — по-английски, отчего форма выглядела наполовину переведённой.
// i18nReady не реджектится и сам снимается по таймауту, так что не приехавший
// чанк даёт непереведённый текст, а не белый экран.
const telegramLanguageCapped = Promise.race([
  telegramLanguageReady.catch(() => undefined),
  new Promise<void>((resolve) => setTimeout(resolve, 5000)),
]);

void Promise.all([i18nReady, telegramLanguageCapped, themeColorsReady]).then(() => {
  ReactDOM.createRoot(required(document.getElementById('root'))).render(
    <React.StrictMode>
      <ErrorBoundary level="app">
        <QueryClientProvider client={queryClient}>
          <AppWithNavigator />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
});
