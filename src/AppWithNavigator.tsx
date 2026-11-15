import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import {
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  offBackButtonClick,
  retrieveLaunchParams,
} from '@telegram-apps/sdk-react';
import Twemoji from '@/lib/twemoji';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlatformProvider } from './platform/PlatformProvider';
import { ThemeColorsProvider } from './providers/ThemeColorsProvider';
import { DocumentBranding } from './components/DocumentBranding';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { ToastProvider } from './components/Toast';
import { TooltipProvider } from './components/primitives/Tooltip';
import { isInTelegramWebApp, closeTelegramApp } from './hooks/useTelegramSDK';
import { getFallbackParentPath } from './utils/navigation';
import { useBlockingStore } from './store/blocking';

const TWEMOJI_OPTIONS = { className: 'twemoji', folder: 'svg', ext: '.svg' } as const;

/**
 * Manages Telegram BackButton visibility based on navigation location.
 * Shows back button on non-root routes, hides on root.
 */
/** Pages reachable from bottom nav — treat as top-level (no back button). */
// Ровно вкладки нижней панели (mobileNavRoutes.ts). Баланс и список подписок в панели больше нет.
const BOTTOM_NAV_PATHS = ['/', '/referral', '/support', '/profile', '/wheel'];

/** Matches /subscriptions/:numericId. The /subscriptions list auto-redirects
 * straight back here whenever there is a subscription (Subscriptions.tsx), so
 * this page is effectively top-level: we hide the back button and let Telegram
 * surface its native Close (X). */
const SUBSCRIPTION_DETAIL_RE = /^\/subscriptions\/\d+\/?$/;

function TelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  // A full-screen blocking overlay (maintenance / channel-sub / blacklist /
  // account-deleted / backend-unavailable) takes over the native back button:
  // there is nowhere to navigate, so it becomes a single, stable EXIT control.
  const blockingType = useBlockingStore((state) => state.blockingType);
  const blockingTypeRef = useRef(blockingType);
  blockingTypeRef.current = blockingType;

  // Reliable in-app navigation depth (the app's entry point is 0). Driven by
  // React Router's navigation TYPE — NOT window.history.state.idx, which the
  // app's own redirects mutate unpredictably and which is the root flake behind
  // issue #436 (the back button shows/acts on the wrong state). PUSH goes
  // deeper, POP unwinds, REPLACE (e.g. the Subscriptions.tsx auto-redirect) is
  // flat. De-duped by location.key so StrictMode's double-effect can't miscount.
  const depthRef = useRef(0);
  const lastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastKeyRef.current === location.key) return;
    lastKeyRef.current = location.key;
    if (navType === 'PUSH') depthRef.current += 1;
    else if (navType === 'POP') depthRef.current = Math.max(0, depthRef.current - 1);
    // REPLACE: depth unchanged (replaces the current entry, adds no history)
  }, [location.key, navType]);

  useEffect(() => {
    // On a blocking overlay, keep exactly one visible Back button (its click
    // exits the app — see handler). Skip the route logic so it can't flip
    // between Back and Close as the hidden route changes underneath.
    if (blockingType) {
      try {
        showBackButton();
      } catch {}
      return;
    }
    const isTopLevel = location.pathname === '' || BOTTOM_NAV_PATHS.includes(location.pathname);
    // Depth-independent on purpose: whether the user deep-linked in or navigated
    // here in-app, a detail whose list just bounces back has no real "back"
    // target. Showing Back here is exactly what looped through the redirecting
    // /subscriptions list (#436); hiding it always surfaces Close.
    const isSubscriptionDetail = SUBSCRIPTION_DETAIL_RE.test(location.pathname);
    try {
      if (isTopLevel || isSubscriptionDetail) {
        hideBackButton();
      } else {
        showBackButton();
      }
    } catch {}
  }, [location, blockingType]);

  // Stable handler — ref prevents re-subscription on every render
  const handler = useCallback(() => {
    // A blocking overlay is a hard block with nowhere to navigate — the back
    // button's only job is to EXIT the Mini App (no SPA navigation, so it can't
    // flip-flop between Back and Close).
    if (blockingTypeRef.current) {
      closeTelegramApp();
      return;
    }
    // Real in-app history (depth > 0): a normal back. Otherwise we were opened
    // directly on this route via a deep-link — navigate(-1) is a no-op, so fall
    // back to a sensible parent route instead.
    if (depthRef.current > 0) {
      navigateRef.current(-1);
      return;
    }
    // /subscriptions/:id is special: the /subscriptions list auto-redirects
    // straight back to a detail page (Subscriptions.tsx), so falling back there
    // loops silently and the back button looks dead (issue #436). Escape to root.
    const pathname = pathnameRef.current;
    const fallback = SUBSCRIPTION_DETAIL_RE.test(pathname)
      ? '/'
      : getFallbackParentPath(pathname);
    navigateRef.current(fallback, { replace: true });
  }, []);

  useEffect(() => {
    try {
      onBackButtonClick(handler);
    } catch {}
    return () => {
      try {
        offBackButtonClick(handler);
      } catch {}
    };
  }, [handler]);

  return null;
}

/** Supported startapp params → in-app destinations. */
const START_PARAM_ROUTES: Array<{ re: RegExp; to: (match: RegExpExecArray) => string }> = [
  // Admin ticket notification buttons in group chats (bot issue #2988).
  { re: /^admin_ticket_(\d+)$/, to: (match) => `/admin/tickets/${match[1]}` },
  // «Продлить» links for expired subscriptions in the bot's rich main menu.
  { re: /^renew_(\d+)$/, to: (match) => `/subscriptions/${match[1]}/renew` },
  { re: /^subscriptions$/, to: () => '/subscriptions' },
  // «Активировать триал» link in the bot's rich main menu.
  { re: /^trial$/, to: () => '/' },
  // Ссылка на спин из канала: колесо открывается сразу, код применяется сам.
  { re: /^spin_([A-Za-z0-9]+)$/, to: (match) => `/wheel?promo=${match[1]}` },
];

/**
 * Routes a Telegram Mini App start param to an in-app destination on launch.
 *
 * Text links and buttons outside private-chat web_app buttons can only enter the
 * Mini App via `t.me/<bot>/<app>?startapp=<param>` deep links: admin ticket
 * notifications in GROUP/channel chats (bot issue #2988) and the bot's rich
 * main-menu «Продлить» links for expired subscriptions. Telegram delivers the
 * param as `tgWebAppStartParam`. Access is still gated by each route's own guards
 * (e.g. `PermissionRoute`).
 *
 * Адрес меняем до старта роутера: иначе на первом открытии без сохранённого входа
 * редирект на /login запоминал главную, и ссылка терялась.
 */
function applyStartParamRoute() {
  let startParam: string | undefined;
  try {
    startParam = retrieveLaunchParams().tgWebAppStartParam;
  } catch {
    return;
  }
  if (!startParam) return;

  for (const { re, to } of START_PARAM_ROUTES) {
    const match = re.exec(startParam);
    if (match) {
      window.history.replaceState(null, '', to(match) + window.location.hash);
      return;
    }
  }
}

export function AppWithNavigator() {
  const isTelegram = isInTelegramWebApp();
  useState(() => {
    if (isTelegram) applyStartParamRoute();
  });

  return (
    <BrowserRouter>
      {isTelegram && <TelegramBackButton />}
      <ErrorBoundary level="page">
        <PlatformProvider>
          <ThemeColorsProvider>
            <DocumentBranding />
            <TooltipProvider>
              <ToastProvider>
                <WebSocketProvider>
                  <Twemoji options={TWEMOJI_OPTIONS}>
                    <App />
                  </Twemoji>
                </WebSocketProvider>
              </ToastProvider>
            </TooltipProvider>
          </ThemeColorsProvider>
        </PlatformProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
