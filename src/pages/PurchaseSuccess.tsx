import { isLifetimePeriod } from '@/utils/lifetime';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { landingApi } from '../api/landings';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { copyToClipboard } from '../utils/clipboard';
import {
  PiCheckBold,
  PiClockCountdownDuotone,
  PiCopyBold,
  PiWarningCircleDuotone,
} from 'react-icons/pi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/spofy/ui';
import { Spinner } from '@/components/ui/Spinner';
import { AnimatedCheckmark } from '@/components/ui/AnimatedCheckmark';
import { AnimatedCrossmark } from '@/components/ui/AnimatedCrossmark';
import { cn } from '../lib/utils';
import { plainTariffName } from '@/utils/plainTariffName';

const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes

// Кнопки экрана в стиле v10 (как Button из блоков Spofy).
const primaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold text-on-cta transition-colors active:scale-[0.98]';
const secondaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition-colors active:scale-[0.98]';

/** Крупная иконка состояния (вместо анимированной галочки там, где её нет). */
function StateIcon({ tone, children }: { tone: 'warning' | 'muted'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'flex h-16 w-16 items-center justify-center rounded-3xl [&>svg]:h-8 [&>svg]:w-8',
        tone === 'warning' ? 'bg-warning-500/10 text-warning-400' : 'bg-dark-800/80 text-dark-300',
      )}
    >
      {children}
    </span>
  );
}

function PendingState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <Spinner className="h-16 w-16 border-[3px]" />
      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {t('landing.awaitingPayment', 'Awaiting payment')}
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-dark-400">
          {t('landing.awaitingPaymentDesc')}
        </p>
      </div>
    </motion.div>
  );
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await copyToClipboard(value);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed silently
    }
  }, [value]);

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-dark-800/50 px-4 py-3">
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] text-dark-400">{label}</p>
        <p className="mt-0.5 select-all break-all text-[15px] font-medium text-dark-50">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-colors',
          copied
            ? 'bg-success-500/10 text-success-400'
            : 'bg-dark-700/60 text-dark-100 hover:bg-dark-700',
        )}
      >
        {copied ? <PiCheckBold className="h-3.5 w-3.5" /> : <PiCopyBold className="h-3.5 w-3.5" />}
        {copied ? t('landing.copied', 'Copied!') : t('landing.copy', 'Copy')}
      </button>
    </div>
  );
}

function CabinetCredentialsState({
  cabinetEmail,
  cabinetPassword,
  autoLoginToken,
  tariffName,
  periodDays,
}: {
  cabinetEmail: string;
  cabinetPassword: string | null;
  autoLoginToken: string | null;
  tariffName: string | null;
  periodDays: number | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTokens, setUser, checkAdminStatus } = useAuthStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(false);

  const handleGoToCabinet = useCallback(async () => {
    if (!autoLoginToken) {
      navigate('/login');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(false);
    try {
      const response = await authApi.autoLogin(autoLoginToken);
      setTokens(response.access_token, response.refresh_token);
      setUser(response.user);
      await checkAdminStatus();
      navigate('/');
    } catch {
      setLoginError(true);
      setIsLoggingIn(false);
    }
  }, [autoLoginToken, navigate, setTokens, setUser, checkAdminStatus]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <AnimatedCheckmark />

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {t('landing.cabinetReady')}
        </h2>
        {tariffName && periodDays !== null && (
          <p className="mt-1 text-[15px] text-dark-300">
            {tariffName} —{' '}
            {isLifetimePeriod(periodDays)
              ? t('subscription.lifetime.forever')
              : `${periodDays} ${t('landing.daysAccess')}`}
          </p>
        )}
      </div>

      {/* Credentials */}
      <div className="w-full space-y-3">
        <CopyableField label={t('landing.cabinetEmail')} value={cabinetEmail} />
        {cabinetPassword && (
          <CopyableField label={t('landing.cabinetPassword')} value={cabinetPassword} />
        )}
        {cabinetPassword && (
          <p className="text-[13px] text-dark-400">{t('landing.saveCredentials')}</p>
        )}
        {!cabinetPassword && (
          <p className="text-[13px] text-dark-400">{t('landing.credentialsSentToEmail')}</p>
        )}
      </div>

      {/* Go to Cabinet button */}
      <button
        type="button"
        onClick={handleGoToCabinet}
        disabled={isLoggingIn}
        className={cn(
          primaryBtn,
          isLoggingIn ? 'cursor-not-allowed bg-cta-500/50' : 'bg-cta-500 hover:bg-cta-600',
        )}
      >
        {isLoggingIn ? (
          <>
            <Spinner className="h-4 w-4" />
            {t('landing.autoLoginProcessing')}
          </>
        ) : (
          t('landing.goToCabinet')
        )}
      </button>
      {loginError && <p className="text-[13px] text-error-400">{t('landing.autoLoginFailed')}</p>}
    </motion.div>
  );
}

function SuccessState({
  subscriptionUrl,
  cryptoLink,
  contactValue,
  recipientContactValue,
  tariffName,
  periodDays,
  isGift,
  giftMessage,
  recipientInBot,
  botLink,
  contactType,
}: {
  subscriptionUrl: string | null;
  cryptoLink: string | null;
  contactValue: string | null;
  recipientContactValue: string | null;
  tariffName: string | null;
  periodDays: number | null;
  isGift: boolean;
  giftMessage: string | null;
  recipientInBot: boolean | null;
  botLink: string | null;
  contactType: string | null;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const url = subscriptionUrl ?? cryptoLink;
    if (!url) return;

    try {
      await copyToClipboard(url);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed silently
    }
  }, [subscriptionUrl, cryptoLink]);

  const displayUrl = subscriptionUrl ?? cryptoLink;
  const displayContact = isGift ? recipientContactValue : contactValue;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <AnimatedCheckmark />

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {isGift ? t('landing.giftSentSuccess') : t('landing.purchaseSuccess')}
        </h2>
        {tariffName && periodDays !== null && (
          <p className="mt-1 text-[15px] text-dark-300">
            {tariffName} —{' '}
            {isLifetimePeriod(periodDays)
              ? t('subscription.lifetime.forever')
              : `${periodDays} ${t('landing.daysAccess')}`}
          </p>
        )}
        {isGift && contactType === 'telegram' && recipientInBot === true && (
          <p className="mt-2 text-[15px] leading-snug text-dark-400">
            {t('landing.giftTelegramSent')}
          </p>
        )}
        {isGift && contactType === 'telegram' && recipientInBot !== true && (
          <p className="mt-2 text-[15px] leading-snug text-dark-400">
            {t('landing.giftTelegramNotInBot')}
          </p>
        )}
        {!(isGift && contactType === 'telegram') && displayContact && (
          <p className="mt-2 text-[15px] leading-snug text-dark-400">
            {isGift
              ? t('landing.giftSentTo', { contact: displayContact })
              : t('landing.keySentTo', { contact: displayContact })}
          </p>
        )}
        {isGift && giftMessage && (
          <p className="mt-2 text-[15px] italic text-dark-400">
            {t('landing.giftMessage')}: {giftMessage}
          </p>
        )}
      </div>

      {/* Bot link for telegram gifts where recipient is not in bot */}
      {isGift && contactType === 'telegram' && recipientInBot !== true && botLink && (
        <a
          href={botLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(primaryBtn, 'bg-cta-500 hover:bg-cta-600')}
        >
          {t('landing.openBot')}
        </a>
      )}

      {/* QR Code */}
      {displayUrl && (
        <div className="flex w-full flex-col items-center space-y-4">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG
              value={displayUrl}
              size={200}
              level="M"
              includeMargin={false}
              className="h-[200px] w-[200px]"
            />
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              secondaryBtn,
              copied
                ? 'bg-success-500/10 text-success-400'
                : 'bg-dark-800/70 text-dark-100 hover:bg-dark-700/70',
            )}
          >
            {copied ? (
              <>
                <PiCheckBold className="h-4 w-4" />
                {t('landing.copied', 'Copied!')}
              </>
            ) : (
              <>
                <PiCopyBold className="h-4 w-4" />
                {t('landing.copyLink', 'Copy link')}
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function PendingActivationState({
  tariffName,
  periodDays,
  giftMessage,
  isGift,
  isActivating,
  onActivate,
  autoLoginToken,
}: {
  tariffName: string | null;
  periodDays: number | null;
  giftMessage: string | null;
  isGift: boolean;
  isActivating: boolean;
  onActivate: () => void;
  autoLoginToken: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTokens, setUser, checkAdminStatus } = useAuthStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoToCabinet = useCallback(async () => {
    if (!autoLoginToken) {
      navigate('/login');
      return;
    }
    setIsLoggingIn(true);
    try {
      const response = await authApi.autoLogin(autoLoginToken);
      setTokens(response.access_token, response.refresh_token);
      setUser(response.user);
      await checkAdminStatus();
      navigate('/');
    } catch {
      setIsLoggingIn(false);
      navigate('/login');
    }
  }, [autoLoginToken, navigate, setTokens, setUser, checkAdminStatus]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      {/* Warning icon */}
      <StateIcon tone="warning">
        <PiWarningCircleDuotone />
      </StateIcon>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {t('landing.pendingActivation')}
        </h2>
        {tariffName && periodDays !== null && (
          <p className="mt-1 text-[15px] text-dark-300">
            {tariffName} —{' '}
            {isLifetimePeriod(periodDays)
              ? t('subscription.lifetime.forever')
              : `${periodDays} ${t('landing.daysAccess')}`}
          </p>
        )}
        <p className="mt-2 text-[15px] leading-snug text-dark-400">
          {t('landing.pendingActivationDesc')}
        </p>
        {isGift && giftMessage && (
          <p className="mt-2 text-[15px] italic text-dark-400">
            {t('landing.giftMessage')}: {giftMessage}
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onActivate}
          disabled={isActivating}
          className={cn(
            primaryBtn,
            isActivating ? 'cursor-not-allowed bg-cta-500/50' : 'bg-cta-500 hover:bg-cta-600',
          )}
        >
          {isActivating ? (
            <>
              <Spinner className="h-4 w-4" />
              {t('landing.activating')}
            </>
          ) : (
            t('landing.activateNow')
          )}
        </button>

        {autoLoginToken && (
          <button
            type="button"
            onClick={handleGoToCabinet}
            disabled={isLoggingIn}
            className={cn(
              secondaryBtn,
              isLoggingIn
                ? 'cursor-not-allowed bg-dark-800/30 text-dark-400'
                : 'bg-dark-800/70 text-dark-100 hover:bg-dark-700/70',
            )}
          >
            {isLoggingIn ? (
              <>
                <Spinner className="h-4 w-4" />
                {t('landing.autoLoginProcessing')}
              </>
            ) : (
              t('landing.goToCabinet')
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function GiftPendingActivationState({
  tariffName,
  periodDays,
  recipientContactValue,
  giftMessage,
  recipientInBot,
  botLink,
  contactType,
}: {
  tariffName: string | null;
  periodDays: number | null;
  recipientContactValue: string | null;
  giftMessage: string | null;
  recipientInBot: boolean | null;
  botLink: string | null;
  contactType: string | null;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <AnimatedCheckmark />

      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {t('landing.giftSentSuccess')}
        </h2>
        {tariffName && periodDays !== null && (
          <p className="mt-1 text-[15px] text-dark-300">
            {tariffName} —{' '}
            {isLifetimePeriod(periodDays)
              ? t('subscription.lifetime.forever')
              : `${periodDays} ${t('landing.daysAccess')}`}
          </p>
        )}
        {contactType === 'telegram' && recipientInBot === true && (
          <p className="mt-2 text-[15px] leading-snug text-dark-400">
            {t('landing.giftTelegramPendingSent')}
          </p>
        )}
        {contactType === 'telegram' && recipientInBot !== true && (
          <p className="mt-2 text-[15px] leading-snug text-dark-400">
            {t('landing.giftTelegramPendingNotInBot')}
          </p>
        )}
        {contactType !== 'telegram' && (
          <p className="mt-2 text-[15px] leading-snug text-dark-400">
            {t('landing.giftPendingActivationDesc')}
          </p>
        )}
        {contactType !== 'telegram' && recipientContactValue && (
          <p className="mt-2 text-[15px] leading-snug text-dark-400">
            {t('landing.giftSentTo', { contact: recipientContactValue })}
          </p>
        )}
        {giftMessage && (
          <p className="mt-2 text-[15px] italic text-dark-400">
            {t('landing.giftMessage')}: {giftMessage}
          </p>
        )}
      </div>

      {/* Bot link for telegram gifts where recipient is not in bot */}
      {contactType === 'telegram' && recipientInBot !== true && botLink && (
        <a
          href={botLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(primaryBtn, 'bg-cta-500 hover:bg-cta-600')}
        >
          {t('landing.openBot')}
        </a>
      )}
    </motion.div>
  );
}

function FailedState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <AnimatedCrossmark />
      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {t('landing.purchaseFailed')}
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-dark-400">
          {t('landing.purchaseFailedDesc')}
        </p>
      </div>
    </motion.div>
  );
}

function PollTimedOutState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <StateIcon tone="muted">
        <PiClockCountdownDuotone />
      </StateIcon>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {t('landing.pollTimedOut', 'Taking longer than expected')}
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-dark-400">
          {t(
            'landing.pollTimedOutDesc',
            'Payment processing is taking longer than usual. You can try checking again.',
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(primaryBtn, 'bg-cta-500 hover:bg-cta-600')}
      >
        {t('common.retry', 'Retry')}
      </button>
    </motion.div>
  );
}

function GiftLinkShareState({
  claimUrl,
  botClaimLink,
  tariffName,
  periodDays,
  recipientContactValue,
  contactType,
}: {
  claimUrl: string | null;
  botClaimLink: string | null;
  tariffName: string | null;
  periodDays: number | null;
  recipientContactValue: string | null;
  contactType: 'email' | 'telegram' | null;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const message = [
    t('landing.giftLink.shareText', 'I have a gift for you! Activate it here:'),
    '',
    claimUrl,
    botClaimLink ? `${t('landing.giftLink.viaTelegram', 'Telegram:')} ${botClaimLink}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const handleCopy = async () => {
    try {
      await copyToClipboard(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-5 text-center"
    >
      <AnimatedCheckmark />
      <div>
        <h2 className="text-xl font-bold tracking-tight text-dark-50">
          {t('landing.giftLink.title', 'Gift is ready!')}
        </h2>
        {tariffName && periodDays !== null && (
          <p className="mt-1 text-[15px] text-dark-300">
            {tariffName} —{' '}
            {isLifetimePeriod(periodDays)
              ? t('subscription.lifetime.forever')
              : `${periodDays} ${t('landing.daysAccess')}`}
          </p>
        )}
      </div>

      <p className="text-[15px] leading-snug text-dark-300">
        {t(
          'landing.giftLink.subtitle',
          'Send this link to whoever you want to receive the gift — they activate it themselves.',
        )}
      </p>

      {claimUrl && (
        <CopyableField label={t('landing.giftLink.linkLabel', 'Gift link')} value={claimUrl} />
      )}
      {botClaimLink && (
        <CopyableField
          label={t('landing.giftLink.telegramLabel', 'Telegram link')}
          value={botClaimLink}
        />
      )}

      {recipientContactValue && contactType === 'email' && (
        <p className="text-[13px] text-dark-500">
          {t('landing.giftLink.alsoSent', {
            contact: recipientContactValue,
            defaultValue: 'We also emailed it to {{contact}}.',
          })}
        </p>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition-colors active:scale-[0.98]',
          copied ? 'bg-success-500/15 text-success-400' : 'bg-cta-500 text-on-cta hover:bg-cta-600',
        )}
      >
        {copied ? (
          <>
            <PiCheckBold className="h-4 w-4" />
            {t('landing.copied', 'Copied!')}
          </>
        ) : (
          <>
            <PiCopyBold className="h-4 w-4" />
            {t('landing.giftLink.copyMessage', 'Copy message')}
          </>
        )}
      </button>
    </motion.div>
  );
}

export default function PurchaseSuccess() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const isActivateHint = searchParams.get('activate') === '1';
  const pollStart = useRef(Date.now());
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState(false);
  const activatingRef = useRef(false);

  // Referrer-Policy: prevent leaking payment token via referer header
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const queryClient = useQueryClient();

  const {
    data: purchaseStatus,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['purchase-status', token],
    queryFn: () => landingApi.getPurchaseStatus(token!),
    enabled: !!token && !pollTimedOut,
    refetchInterval: (query) => {
      const data = query.state.data;
      const currentStatus = data?.status;
      // A gift that reached PAID is terminal for the BUYER (it stays PAID until
      // the recipient claims) — stop polling and show the share link instead of
      // spinning. A paid gift is always claimable, so don't gate on is_claimable.
      if (currentStatus === 'paid' && data?.is_gift) return false;
      if (currentStatus === 'pending' || currentStatus === 'paid') {
        if (Date.now() - pollStart.current > MAX_POLL_MS) {
          setPollTimedOut(true);
          return false;
        }
        return 3_000;
      }
      return false;
    },
    retry: 2,
  });

  const handleRetryPoll = useCallback(() => {
    pollStart.current = Date.now();
    setPollTimedOut(false);
    refetch();
  }, [refetch]);

  const handleActivate = useCallback(async () => {
    if (!token || activatingRef.current) return;
    activatingRef.current = true;
    setIsActivating(true);
    setActivationError(false);
    try {
      const result = await landingApi.activatePurchase(token);
      queryClient.setQueryData(['purchase-status', token], result);
    } catch {
      setActivationError(true);
    } finally {
      activatingRef.current = false;
      setIsActivating(false);
    }
  }, [token, queryClient]);

  const isSuccess = purchaseStatus?.status === 'delivered';

  // Fire analytics goal on successful delivery (once per purchase).
  // Idempotency keyed by token so a page refresh doesn't double-count.
  useEffect(() => {
    if (!isSuccess || !token) return;
    const FIRED_KEY = `ym_buy_success_${token}`;
    try {
      if (localStorage.getItem(FIRED_KEY)) return;
    } catch {
      /* ignore */
    }
    try {
      const counterId = localStorage.getItem('ym_counter_id');
      const w = window as unknown as Record<string, unknown>;
      if (counterId && typeof w.ym === 'function') {
        (w.ym as (...args: unknown[]) => void)(Number(counterId), 'reachGoal', 'buy_success');
        try {
          localStorage.setItem(FIRED_KEY, '1');
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* analytics error */
    }
  }, [isSuccess, token]);

  const isPendingActivation = purchaseStatus?.status === 'pending_activation';
  const isFailed = purchaseStatus?.status === 'failed' || purchaseStatus?.status === 'expired';

  // Deferred gift the buyer just paid for → show the transferable claim link to
  // forward (it stays PAID until the recipient claims it).
  const isBuyerGiftLink = purchaseStatus?.status === 'paid' && !!purchaseStatus?.is_gift;

  // Gift pending activation → buyer sees "gift sent" message, not the activate button.
  // Recipient arrives via email link with ?activate=1 and sees the activate button instead.
  const isGiftPendingActivation = isPendingActivation && purchaseStatus?.is_gift && !isActivateHint;

  // Email self-purchase delivered → show cabinet credentials
  const isEmailSelfPurchase =
    isSuccess &&
    purchaseStatus.contact_type === 'email' &&
    !purchaseStatus.is_gift &&
    purchaseStatus.cabinet_email;

  return (
    // py-10 — карточка выше экрана не липнет к его краям (как у подарка и купона).
    // anywhere — почта получателя в центрованной колонке переносится, а не
    // растягивает колонку шире карточки (наследуется всеми состояниями).
    <div className="min-h-dvh bg-dark-950 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <PageHeader title={t('landing.resultTitle', 'Покупка')} backTo="/" />
        <Surface className="p-6 [overflow-wrap:anywhere] sm:p-7">
          <div aria-live="polite" aria-atomic="true">
            {isError ? (
              <FailedState />
            ) : isBuyerGiftLink ? (
              <GiftLinkShareState
                claimUrl={purchaseStatus.claim_url}
                botClaimLink={purchaseStatus.bot_claim_link}
                tariffName={plainTariffName(purchaseStatus.tariff_name)}
                periodDays={purchaseStatus.period_days}
                recipientContactValue={purchaseStatus.recipient_contact_value}
                contactType={purchaseStatus.contact_type}
              />
            ) : isEmailSelfPurchase ? (
              <CabinetCredentialsState
                cabinetEmail={purchaseStatus.cabinet_email!}
                cabinetPassword={purchaseStatus.cabinet_password}
                autoLoginToken={purchaseStatus.auto_login_token}
                tariffName={plainTariffName(purchaseStatus.tariff_name)}
                periodDays={purchaseStatus.period_days}
              />
            ) : isSuccess ? (
              <SuccessState
                subscriptionUrl={purchaseStatus.subscription_url}
                cryptoLink={purchaseStatus.subscription_crypto_link}
                contactValue={purchaseStatus.contact_value}
                recipientContactValue={purchaseStatus.recipient_contact_value}
                tariffName={plainTariffName(purchaseStatus.tariff_name)}
                periodDays={purchaseStatus.period_days}
                isGift={purchaseStatus.is_gift}
                giftMessage={purchaseStatus.gift_message}
                recipientInBot={purchaseStatus.recipient_in_bot}
                botLink={purchaseStatus.bot_link}
                contactType={purchaseStatus.contact_type}
              />
            ) : isGiftPendingActivation ? (
              <GiftPendingActivationState
                tariffName={plainTariffName(purchaseStatus.tariff_name)}
                periodDays={purchaseStatus.period_days}
                recipientContactValue={purchaseStatus.recipient_contact_value}
                giftMessage={purchaseStatus.gift_message}
                recipientInBot={purchaseStatus.recipient_in_bot}
                botLink={purchaseStatus.bot_link}
                contactType={purchaseStatus.contact_type}
              />
            ) : isPendingActivation ? (
              <div className="space-y-4">
                <PendingActivationState
                  tariffName={plainTariffName(purchaseStatus.tariff_name)}
                  periodDays={purchaseStatus.period_days}
                  giftMessage={purchaseStatus.gift_message}
                  isGift={purchaseStatus.is_gift}
                  isActivating={isActivating}
                  onActivate={handleActivate}
                  autoLoginToken={purchaseStatus.auto_login_token}
                />
                {activationError && (
                  <p className="text-center text-sm text-error-400">
                    {t('landing.activationFailed')}
                  </p>
                )}
              </div>
            ) : isFailed ? (
              <FailedState />
            ) : pollTimedOut ? (
              <PollTimedOutState onRetry={handleRetryPoll} />
            ) : (
              <PendingState />
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}
