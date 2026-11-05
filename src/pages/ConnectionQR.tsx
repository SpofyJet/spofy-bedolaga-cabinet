import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useBranding } from '../hooks/useBranding';
import { PiCaretLeftBold, PiCheckBold, PiCopyBold } from 'react-icons/pi';
import { Button, Page, Surface } from '@/components/spofy/ui';
import { useHaptic } from '@/platform';
import { copyToClipboard } from '@/utils/clipboard';

interface ConnectionQRState {
  url: string;
  hideLink: boolean;
  subscriptionId?: number;
}

function isValidState(state: unknown): state is ConnectionQRState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return typeof s.url === 'string' && s.url.length > 0 && typeof s.hideLink === 'boolean';
}

export default function ConnectionQR() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { appName } = useBranding();
  const haptic = useHaptic();
  const [copyResult, setCopyResult] = useState<{
    url: string;
    status: 'copying' | 'copied' | 'error';
  } | null>(null);

  const state = location.state as unknown;
  const validState = isValidState(state) ? state : null;
  const copyStatus = copyResult?.url === validState?.url ? copyResult?.status : undefined;
  const handleCopy = async () => {
    if (!validState || validState.hideLink) return;
    const url = validState.url;
    setCopyResult({ url, status: 'copying' });
    try {
      await copyToClipboard(url);
      setCopyResult({ url, status: 'copied' });
    } catch {
      setCopyResult({ url, status: 'error' });
    }
  };
  const subId = validState?.subscriptionId;
  const connectionPath = subId ? `/connection?sub=${subId}` : '/connection';

  useEffect(() => {
    if (!validState) {
      navigate(connectionPath, { replace: true });
    }
  }, [validState, navigate, connectionPath]);

  if (!validState) {
    return null;
  }

  return (
    <Page>
      {/* Шапка как PageHeader, но «назад» всегда ведёт на инструкцию: экран QR
          открывается с replace, и шаг истории назад увёл бы мимо неё. */}
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            haptic.impact('light');
            navigate(connectionPath, { replace: true });
          }}
          aria-label={t('common.back', 'Назад')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-dark-900/70 text-dark-200 transition-colors hover:bg-dark-800/70 hover:text-dark-50 active:scale-95"
        >
          <PiCaretLeftBold className="h-[18px] w-[18px]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-dark-50 sm:text-2xl">
            {t('subscription.connection.qrTitle')}
          </h1>
          {appName && <p className="mt-0.5 truncate text-[13px] text-dark-400">{appName}</p>}
        </div>
      </header>

      <Surface className="flex flex-col items-center gap-4 text-center">
        <p className="text-[13px] text-dark-400">{t('subscription.connection.qrScanHint')}</p>
        {/* QR всегда на белом: тёмный код на тёмном фоне камеры читают хуже */}
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG
            value={validState.url}
            size={280}
            level="M"
            includeMargin={false}
            className="h-[240px] w-[240px] sm:h-[300px] sm:w-[300px]"
          />
        </div>
      </Surface>

      {!validState.hideLink && (
        <Surface className="min-w-0 space-y-3">
          <p
            dir="ltr"
            className="max-h-32 select-text overflow-y-auto break-all whitespace-normal rounded-2xl bg-dark-800/50 px-3 py-2.5 text-left text-xs leading-relaxed text-dark-300"
          >
            {validState.url}
          </p>
          <Button
            tone="secondary"
            className="w-full"
            disabled={copyStatus === 'copying'}
            onClick={handleCopy}
          >
            {copyStatus === 'copied' ? (
              <PiCheckBold className="h-4 w-4 text-success-400" />
            ) : (
              <PiCopyBold className="h-4 w-4" />
            )}
            <span aria-live="polite">
              {copyStatus === 'copied' ? t('common.copied') : t('subscription.connection.copyLink')}
            </span>
          </Button>
          {copyStatus === 'error' && (
            <p role="alert" className="text-[13px] text-error-400">
              {t('subscription.connection.copyFailed')}
            </p>
          )}
          <p className="text-xs text-dark-500">
            {t(
              'subscription.connection.v10.personalKey',
              'Это ваш личный ключ — никому его не пересылайте',
            )}
          </p>
        </Surface>
      )}
    </Page>
  );
}
