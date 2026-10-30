import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/auth';
import {
  peekLinkOAuthState,
  clearLinkOAuthState,
  loadOAuthState,
  clearOAuthState,
  getErrorDetail,
} from '../utils/oauth';
import type { ServerCompletePreviewResponse, ServerCompleteResponse } from '../types';
import { CheckIcon, ExclamationIcon } from '@/components/icons';

type CallbackMode = 'login' | 'link-browser' | 'link-server';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [errorMode, setErrorMode] = useState<CallbackMode>('login');
  const [serverLinkResult, setServerCompleteResponse] = useState<ServerCompleteResponse | null>(
    null,
  );
  // External-browser link (Mini App flow): the state is not from this browser, so
  // the owner must see which account the provider will be linked to and confirm.
  // Auto-completing let anyone send their authorize_url and capture the victim's login.
  const [pendingServerLink, setPendingServerLink] = useState<{
    code: string;
    state: string;
    deviceId: string | null;
    preview: ServerCompletePreviewResponse;
  } | null>(null);
  const [confirmingServerLink, setConfirmingServerLink] = useState(false);
  const loginWithOAuth = useAuthStore((state) => state.loginWithOAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasRun = useRef(false);

  // Handle merge redirect via useEffect (not in render)
  useEffect(() => {
    if (serverLinkResult?.merge_required && serverLinkResult.merge_token) {
      navigate(`/merge/${serverLinkResult.merge_token}`, { replace: true });
    }
  }, [serverLinkResult, navigate]);

  useEffect(() => {
    // Prevent double-fire from React StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');
    const urlState = searchParams.get('state');
    const deviceId = searchParams.get('device_id');

    if (!code || !urlState) {
      setError(t('auth.oauthError', 'Authorization was denied or failed'));
      return;
    }

    // Determine callback mode:
    // 1. Link state in sessionStorage → browser linking flow
    // 2. Login state in sessionStorage → login flow
    // 3. Neither → opened from external browser (Mini App flow) → server-complete
    let mode: CallbackMode = 'link-server';
    let provider: string | undefined;
    let state: string | undefined;

    const linkSaved = peekLinkOAuthState();
    if (linkSaved && linkSaved.state === urlState) {
      clearLinkOAuthState();
      mode = 'link-browser';
      provider = linkSaved.provider;
      state = linkSaved.state;
    } else {
      const loginSaved = loadOAuthState();
      if (loginSaved && loginSaved.state === urlState) {
        clearOAuthState();
        mode = 'login';
        provider = loginSaved.provider;
        state = loginSaved.state;
      }
    }

    const handle = async () => {
      // Clear sensitive OAuth params (code, state) from URL immediately for all modes
      window.history.replaceState({}, '', '/auth/oauth/callback');

      if (mode === 'link-browser' && provider && state) {
        // Browser linking: user is authenticated, complete via JWT-protected endpoint
        try {
          const response = await authApi.linkProviderCallback(
            provider,
            code,
            state,
            deviceId ?? undefined,
          );
          if (response.merge_required && response.merge_token) {
            navigate(`/merge/${response.merge_token}`, { replace: true });
          } else {
            navigate('/profile/accounts', { replace: true });
          }
        } catch (err: unknown) {
          setErrorMode('link-browser');
          setError(getErrorDetail(err) || t('profile.accounts.linkError'));
        }
        return;
      }

      if (mode === 'login' && provider && state) {
        // Login flow
        if (isAuthenticated) {
          navigate('/', { replace: true });
          return;
        }
        try {
          await loginWithOAuth(provider, code, state, deviceId);
          navigate('/', { replace: true });
        } catch (err: unknown) {
          const detail = getErrorDetail(err);
          setError(detail || t('auth.oauthError', 'Authorization was denied or failed'));
        }
        return;
      }

      // mode === 'link-server': No sessionStorage state found.
      // This happens when OAuth was opened in external browser from Mini App.
      // Show which account will be linked; complete only after explicit confirmation.
      try {
        const preview = await authApi.linkServerCompletePreview(urlState);
        setPendingServerLink({ code, state: urlState, deviceId, preview });
      } catch (err: unknown) {
        setErrorMode('link-server');
        setError(getErrorDetail(err) || t('profile.accounts.linkError'));
      }
    };

    handle();
  }, [searchParams, loginWithOAuth, navigate, isAuthenticated, t]);

  const confirmServerLink = async () => {
    if (!pendingServerLink || confirmingServerLink) return;
    setConfirmingServerLink(true);
    try {
      const response = await authApi.linkServerComplete(
        pendingServerLink.code,
        pendingServerLink.state,
        pendingServerLink.deviceId ?? undefined,
      );
      setPendingServerLink(null);
      setServerCompleteResponse(response);
    } catch (err: unknown) {
      setPendingServerLink(null);
      setErrorMode('link-server');
      setError(getErrorDetail(err) || t('profile.accounts.linkError'));
    } finally {
      setConfirmingServerLink(false);
    }
  };

  if (pendingServerLink && !error) {
    return (
      <div className="min-h-viewport flex items-center justify-center px-4 py-8">
        <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <h2 className="mb-2 text-lg font-semibold text-dark-50">
              {t('profile.accounts.confirmLinkTitle', 'Confirm account linking')}
            </h2>
            <p className="mb-2 text-sm text-dark-400">
              {t(
                'profile.accounts.confirmLinkText',
                'Your {{provider}} sign-in will be linked to this account:',
                { provider: pendingServerLink.preview.provider },
              )}
            </p>
            <p className="mb-4 break-words font-medium text-dark-50">
              {pendingServerLink.preview.account_label}
            </p>
            <p className="mb-6 text-xs text-dark-400">
              {t(
                'profile.accounts.confirmLinkWarning',
                'If this is not your account or you did not start linking, close this page: whoever owns that account would be able to sign in with your login.',
              )}
            </p>
            <button
              onClick={confirmServerLink}
              disabled={confirmingServerLink}
              className="btn-primary mb-3 w-full"
            >
              {t('profile.accounts.confirmLinkButton', 'Yes, this is my account — link')}
            </button>
            <button
              onClick={() => {
                setPendingServerLink(null);
                setErrorMode('link-server');
                setError(t('profile.accounts.linkCancelled', 'Linking cancelled'));
              }}
              disabled={confirmingServerLink}
              className="btn-secondary w-full"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Server-complete result: show success with "Return to Telegram" link
  // (merge redirect is handled by the useEffect above)
  if (
    serverLinkResult &&
    serverLinkResult.success &&
    !(serverLinkResult.merge_required && serverLinkResult.merge_token)
  ) {
    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
    const telegramLink = botUsername ? `https://t.me/${botUsername}` : '';

    return (
      <div className="min-h-viewport flex items-center justify-center px-4 py-8">
        <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success-500/20">
              <CheckIcon className="h-8 w-8 text-success-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-dark-50">
              {t('profile.accounts.linkSuccess')}
            </h2>
            <p className="mb-6 text-sm text-dark-400">{t('profile.accounts.returnToTelegram')}</p>
            {telegramLink && (
              <a
                href={telegramLink}
                className="btn-primary inline-block w-full rounded-lg bg-accent-500 px-6 py-3 text-center font-medium text-dark-950 no-underline transition-colors hover:bg-accent-400"
              >
                {t('profile.accounts.openTelegram')}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isServerMode = errorMode === 'link-server';
    const isLinkBrowserMode = errorMode === 'link-browser';
    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
    const telegramLink = botUsername ? `https://t.me/${botUsername}` : '';

    const errorAction =
      isServerMode && telegramLink ? (
        <a
          href={telegramLink}
          className="btn-primary inline-block w-full rounded-lg bg-accent-500 px-6 py-3 text-center font-medium text-dark-950 no-underline transition-colors hover:bg-accent-400"
        >
          {t('profile.accounts.openTelegram')}
        </a>
      ) : isLinkBrowserMode ? (
        <button
          onClick={() => navigate('/profile/accounts', { replace: true })}
          className="btn-primary w-full"
        >
          {t('profile.accounts.backToAccounts', 'Back to accounts')}
        </button>
      ) : (
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="btn-primary w-full"
        >
          {t('auth.backToLogin', 'Back to login')}
        </button>
      );

    return (
      <div className="min-h-viewport flex items-center justify-center px-4 py-8">
        <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/20">
              <ExclamationIcon className="h-8 w-8 text-error-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-dark-50">{t('auth.loginFailed')}</h2>
            <p className="mb-6 text-sm text-dark-400">{error}</p>
            {errorAction}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-viewport flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
      <div className="relative text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        <h2 className="text-lg font-semibold text-dark-50">{t('auth.authenticating')}</h2>
        <p className="mt-2 text-sm text-dark-400">{t('common.loading')}</p>
      </div>
    </div>
  );
}
