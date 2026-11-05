import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { PiCheckBold, PiPencilSimpleLine } from 'react-icons/pi';

import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useCountdown } from '../hooks/useCountdown';
import { getApiErrorMessage } from '../utils/api-error';
import { isValidEmail } from '../utils/validation';
import { usePlatform } from '@/platform';
import { UI } from '../config/constants';
import { Card } from '@/components/data-display/Card';
import { InfoRow } from '@/components/data-display/InfoRow';
import { Button } from '@/components/primitives/Button';
import { ProfileSubHeader } from '@/components/profile/ProfileSubHeader';
import { brandingApi, type EmailAuthEnabled } from '../api/branding';

/** Email — отдельная страница профиля: привязка, смена, верификация. */
export default function ProfileEmail() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [changeEmailStep, setChangeEmailStep] = useState<'email' | 'code' | 'success' | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [changeCode, setChangeCode] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [resendCooldown, startResendCooldown] = useCountdown();
  const [verificationResendCooldown, startVerificationResendCooldown] = useCountdown();
  const newEmailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const { platform } = usePlatform();

  const { data: emailAuthConfig } = useQuery<EmailAuthEnabled>({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    staleTime: 60000,
  });
  const isEmailAuthEnabled = emailAuthConfig?.enabled ?? true;
  const isEmailVerificationEnabled = emailAuthConfig?.verification_enabled ?? true;

  const resendVerificationMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      setSuccess(t('profile.verificationResent'));
      setError(null);
      startVerificationResendCooldown(UI.RESEND_COOLDOWN_SEC);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t('common.error')));
      setSuccess(null);
    },
  });

  const requestEmailChangeMutation = useMutation({
    mutationFn: (emailAddr: string) => authApi.requestEmailChange(emailAddr),
    onSuccess: async (data) => {
      setChangeError(null);
      if (data.expires_in_minutes === 0) {
        setChangeEmailStep('success');
        setUser(await authApi.getMe());
      } else {
        setChangeEmailStep('code');
        startResendCooldown(UI.RESEND_COOLDOWN_SEC);
      }
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      if (detail.includes('already registered') || detail.includes('already in use')) {
        setChangeError(t('profile.changeEmail.emailAlreadyUsed'));
      } else if (detail.includes('same as current')) {
        setChangeError(t('profile.changeEmail.sameEmail'));
      } else if (detail.includes('rate limit') || detail.includes('too many')) {
        setChangeError(t('profile.changeEmail.tooManyRequests'));
      } else {
        setChangeError(detail || t('common.error'));
      }
    },
  });

  const verifyEmailChangeMutation = useMutation({
    mutationFn: (verificationCode: string) => authApi.verifyEmailChange(verificationCode),
    onSuccess: async () => {
      setChangeError(null);
      setChangeEmailStep('success');
      setUser(await authApi.getMe());
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      if (detail.includes('invalid') || detail.includes('wrong')) {
        setChangeError(t('profile.changeEmail.invalidCode'));
      } else if (detail.includes('expired')) {
        setChangeError(t('profile.changeEmail.codeExpired'));
      } else {
        setChangeError(detail || t('common.error'));
      }
    },
  });

  useEffect(() => {
    if (platform === 'telegram') return;
    const timer = setTimeout(() => {
      if (changeEmailStep === 'email') newEmailInputRef.current?.focus();
      else if (changeEmailStep === 'code') codeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [changeEmailStep, platform]);

  useEffect(() => {
    if (changeEmailStep !== 'success') return;
    const timer = setTimeout(() => resetChangeEmail(), 3000);
    return () => clearTimeout(timer);
  }, [changeEmailStep]);

  const resetChangeEmail = () => {
    setChangeEmailStep(null);
    setNewEmail('');
    setChangeCode('');
    setChangeError(null);
    startResendCooldown(0);
  };

  const handleSendChangeCode = () => {
    setChangeError(null);
    if (!newEmail.trim()) {
      setChangeError(t('profile.emailRequired'));
      return;
    }
    if (!isValidEmail(newEmail.trim())) {
      setChangeError(t('profile.invalidEmail'));
      return;
    }
    if (user?.email && newEmail.toLowerCase().trim() === user.email.toLowerCase()) {
      setChangeError(t('profile.changeEmail.sameEmail'));
      return;
    }
    requestEmailChangeMutation.mutate(newEmail.trim());
  };

  const handleVerifyChangeCode = () => {
    setChangeError(null);
    if (!changeCode.trim()) {
      setChangeError(t('profile.changeEmail.enterCode'));
      return;
    }
    if (changeCode.trim().length < 4) {
      setChangeError(t('profile.changeEmail.invalidCode'));
      return;
    }
    verifyEmailChangeMutation.mutate(changeCode.trim());
  };

  if (!isEmailAuthEnabled) {
    return (
      <div className="mx-auto w-full max-w-[600px]">
        <ProfileSubHeader title={t('profile.menu.email', 'Email')} />
        <p className="text-sm text-dark-400">{t('profile.emailAuthDisabled')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <ProfileSubHeader title={t('profile.menu.email', 'Email')} />

      <Card>
        {user?.email ? (
          <div className="space-y-4">
            <InfoRow
              divider
              label="Email"
              value={
                <>
                  <span>{user.email}</span>
                  {user.email_verified ? (
                    <span className="badge-success">{t('profile.verified')}</span>
                  ) : isEmailVerificationEnabled ? (
                    <span className="badge-warning">{t('profile.notVerified')}</span>
                  ) : null}
                </>
              }
            />

            {!user.email_verified && isEmailVerificationEnabled && (
              <div className="rounded-linear bg-warning-500/10 p-4">
                <p className="mb-4 text-sm text-warning-400">{t('profile.verificationRequired')}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => resendVerificationMutation.mutate()}
                    loading={resendVerificationMutation.isPending}
                    disabled={verificationResendCooldown > 0}
                  >
                    {verificationResendCooldown > 0
                      ? t('profile.resendIn', { seconds: verificationResendCooldown })
                      : t('profile.resendVerification')}
                  </Button>
                  <Button variant="secondary" onClick={() => setChangeEmailStep('email')}>
                    <PiPencilSimpleLine className="h-4 w-4" />
                    {t('profile.changeEmail.button')}
                  </Button>
                </div>
              </div>
            )}

            {user.email_verified && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 basis-48 text-sm text-dark-400">
                  {t('profile.canLoginWithEmail')}
                </p>
                <Button
                  variant="secondary"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => setChangeEmailStep('email')}
                >
                  <PiPencilSimpleLine className="h-4 w-4" />
                  {t('profile.changeEmail.button')}
                </Button>
              </div>
            )}

            <AnimatePresence>
              {changeEmailStep === 'email' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-dark-800/50 pt-4">
                    <label className="block text-sm font-medium text-dark-400">
                      {t('profile.changeEmail.newEmail')}
                    </label>
                    <input
                      ref={newEmailInputRef}
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendChangeCode();
                        }
                      }}
                      placeholder="new@email.com"
                      className="input w-full"
                      autoComplete="email"
                    />
                    {changeError && <p className="text-sm text-error-400">{changeError}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={handleSendChangeCode}
                        loading={requestEmailChangeMutation.isPending}
                        disabled={!newEmail.trim()}
                      >
                        {t('profile.changeEmail.sendCode')}
                      </Button>
                      <Button variant="secondary" onClick={resetChangeEmail}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {changeEmailStep === 'code' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-dark-800/50 pt-4">
                    <div className="rounded-linear bg-accent-500/10 p-3">
                      <p className="text-sm text-accent-400">
                        {t('profile.changeEmail.codeSentTo', { email: newEmail })}
                      </p>
                    </div>
                    <label className="block text-sm font-medium text-dark-400">
                      {t('profile.changeEmail.verificationCode')}
                    </label>
                    <input
                      ref={codeInputRef}
                      type="text"
                      inputMode="numeric"
                      value={changeCode}
                      onChange={(e) => setChangeCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleVerifyChangeCode();
                        }
                      }}
                      placeholder="000000"
                      maxLength={6}
                      className="input w-full text-center text-2xl tracking-[0.5em]"
                      autoComplete="one-time-code"
                    />
                    {changeError && <p className="text-sm text-error-400">{changeError}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={handleVerifyChangeCode}
                        loading={verifyEmailChangeMutation.isPending}
                        disabled={!changeCode.trim()}
                      >
                        {t('profile.changeEmail.verify')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setChangeEmailStep('email');
                          setChangeCode('');
                          setChangeError(null);
                        }}
                      >
                        {t('common.back')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => requestEmailChangeMutation.mutate(newEmail.trim())}
                        disabled={resendCooldown > 0 || requestEmailChangeMutation.isPending}
                      >
                        {resendCooldown > 0
                          ? t('profile.changeEmail.resendIn', { seconds: resendCooldown })
                          : t('profile.changeEmail.resendCode')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {changeEmailStep === 'success' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-dark-800/50 pt-4">
                    <div className="flex items-center gap-3 rounded-linear bg-success-500/10 p-4">
                      <PiCheckBold className="text-success-400" />
                      <div>
                        <p className="font-medium text-success-400">
                          {t('profile.changeEmail.success')}
                        </p>
                        <p className="text-sm text-dark-400">{newEmail}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-dark-400">{t('profile.linkEmailDescription')}</p>
            <Button variant="primary" onClick={() => setChangeEmailStep('email')}>
              {t('profile.linkEmail')}
            </Button>
          </div>
        )}

        {(error || success) && user?.email && (
          <div className="mt-4">
            {error && (
              <div className="rounded-linear bg-error-500/10 p-4 text-sm text-error-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-linear bg-success-500/10 p-4 text-sm text-success-400">
                {success}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
