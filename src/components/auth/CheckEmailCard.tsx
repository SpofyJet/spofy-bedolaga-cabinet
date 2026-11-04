import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth';
import { EmailIcon } from '@/components/icons';
import { useCountdown } from '@/hooks/useCountdown';
import { isRateLimitedError } from '@/utils/api-error';

/** Своя пауза между отправками, чтобы кнопка не била в серверный лимит впустую. */
const RESEND_COOLDOWN_SECONDS = 60;

interface CheckEmailCardProps {
  email: string;
  /** Вернуться к форме входа. */
  onBackToLogin: () => void;
  /** Вернуться к регистрации, чтобы поправить опечатку в адресе. */
  onChangeEmail: () => void;
}

/**
 * Экран «Проверьте почту» после регистрации.
 *
 * Раньше он был тупиком: письмо не пришло — и человеку оставалось только
 * «Вернуться ко входу», где его не пускают без подтверждения. Отсюда три вещи:
 * куда смотреть (папки «Спам» и «Рассылки»), как попросить письмо снова и как
 * исправить опечатку в адресе.
 *
 * Кнопка повторной отправки сразу видна, но ждёт минуту: письмо идёт не мгновенно,
 * и первым делом стоит просто подождать, а не долбить кнопку.
 */
export function CheckEmailCard({ email, onBackToLogin, onChangeEmail }: CheckEmailCardProps) {
  const { t } = useTranslation();
  const [cooldown, startCooldown] = useCountdown();
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Отсчёт с самого открытия экрана: письмо только что ушло.
  useEffect(() => {
    startCooldown(RESEND_COOLDOWN_SECONDS);
  }, [startCooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || sending) return;
    setSending(true);
    setNotice(null);
    try {
      await authApi.resendVerificationPublic(email);
      setNotice({ kind: 'ok', text: t('auth.resendSent') });
    } catch (err) {
      setNotice({
        kind: 'error',
        text: isRateLimitedError(err) ? t('auth.resendTooOften') : t('auth.resendError'),
      });
    } finally {
      setSending(false);
      // Пауза и после отказа: повтор в ту же секунду ничего не изменит.
      startCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  return (
    <div className="rounded-3xl bg-dark-900/70 p-6 ring-1 ring-inset ring-dark-800/80 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-500/20">
        <EmailIcon className="h-7 w-7 text-success-400" />
      </div>
      <h2 className="mb-2 text-lg font-bold text-dark-50">{t('auth.checkEmail')}</h2>
      <p className="mb-3 text-sm text-dark-400">{t('auth.verificationSent')}</p>
      <p className="mb-4 text-sm font-medium text-accent-400">{email}</p>
      <p className="mb-4 text-xs text-dark-500">{t('auth.clickLinkToVerify')}</p>

      <p className="mb-5 rounded-2xl bg-dark-800/60 p-3 text-left text-xs leading-relaxed text-dark-400">
        {t('auth.spamHint')}
      </p>

      {notice && (
        <p
          role="status"
          className={`mb-3 text-xs ${notice.kind === 'ok' ? 'text-success-400' : 'text-error-400'}`}
        >
          {notice.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || sending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cta-500 px-5 text-[15px] font-semibold text-on-cta transition-colors hover:bg-cta-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-cta-500/40 w-full"
      >
        {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resendVerification')}
      </button>

      <button
        type="button"
        onClick={onChangeEmail}
        className="mt-3 w-full text-sm text-accent-400 transition-colors hover:text-accent-300"
      >
        {t('auth.useAnotherEmail')}
      </button>

      <button
        onClick={onBackToLogin}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-dark-800/70 px-5 text-[15px] font-semibold text-dark-100 ring-1 ring-inset ring-dark-700/60 transition-colors hover:bg-dark-700/70 disabled:cursor-not-allowed disabled:opacity-50 mt-4 w-full"
      >
        {t('auth.backToLogin')}
      </button>
    </div>
  );
}
