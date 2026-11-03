import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  PiArrowSquareOutBold,
  PiCheckBold,
  PiCheckCircleDuotone,
  PiCopyDuotone,
  PiWarningCircleDuotone,
} from 'react-icons/pi';
import { QRCodeSVG } from 'qrcode.react';

import { useAuthStore } from '../store/auth';
import { balanceApi } from '../api/balance';
import { useCurrency } from '../hooks/useCurrency';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../utils/rateLimit';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import { useHaptic, usePlatform } from '@/platform';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Group, Page, RowIcon, SectionTitle, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import type { PaymentMethod, PaymentMethodOption } from '../types';
import PaymentMethodIcon, { spofyPaymentIcon } from '../components/PaymentMethodIcon';
import { saveTopUpPendingInfo } from '../utils/topUpStorage';
import { getSafeRedirectPath } from '../utils/safeRedirect';
import { openPaymentUrl } from '../utils/openPaymentUrl';
import { getApiErrorMessage } from '../utils/api-error';
import { copyToClipboard } from '@/utils/clipboard';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

const getPreferredOptionId = (options?: PaymentMethod['options']) => {
  if (!options || options.length === 0) return null;

  const sbpOption = options.find((option) => {
    const normalizedId = option.id.toLowerCase();
    const normalizedName = option.name.toLowerCase();
    return (
      normalizedId.includes('sbp') ||
      normalizedName.includes('сбп') ||
      normalizedName.includes('sbp')
    );
  });

  return sbpOption?.id ?? options[0].id;
};

const sortOptionsWithSbpFirst = (options?: PaymentMethod['options']) => {
  if (!options || options.length <= 1) return options ?? [];

  const isPreferredOption = (option: PaymentMethodOption) => {
    const normalizedId = option.id.toLowerCase();
    const normalizedName = option.name.toLowerCase();
    return (
      normalizedId.includes('sbp') ||
      normalizedName.includes('сбп') ||
      normalizedName.includes('sbp')
    );
  };

  return [...options].sort((left, right) => {
    const leftIsPreferred = isPreferredOption(left);
    const rightIsPreferred = isPreferredOption(right);

    if (leftIsPreferred === rightIsPreferred) return 0;
    return leftIsPreferred ? -1 : 1;
  });
};

export default function TopUpAmount() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { methodId } = useParams<{ methodId: string }>();
  const [searchParams] = useSearchParams();
  const { formatAmount, currencySymbol, convertAmount, convertToRub, targetCurrency } =
    useCurrency();
  const { openInvoice, openTelegramLink, openLink, platform } = usePlatform();
  const haptic = useHaptic();
  const inputRef = useRef<HTMLInputElement>(null);

  const returnTo = searchParams.get('returnTo');
  const initialAmountRubles = searchParams.get('amount')
    ? parseFloat(searchParams.get('amount')!)
    : undefined;

  // Fetch payment methods with a real query (dedupes with the method-selection page and
  // Balance via the shared ['payment-methods'] key). A non-reactive getQueryData read used
  // to dead-end on an infinite spinner whenever the cache was cold — reload, browser-back
  // from the provider page, or a deep link straight to this route.
  const { data: methods, isLoading: isMethodsLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });
  const method = methods?.find((m) => m.id === methodId);

  // Назад — к выбору способа: история браузера, а если страницу открыли
  // по прямой ссылке — на баланс (иначе navigate(-1) уводил бы из кабинета).
  const handleNavigateBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/balance', { replace: true });
  }, [navigate]);

  // В Telegram — нативная кнопка «Назад»: своей стрелки там нет, и экран суммы
  // оставался тупиком.
  const { capabilities, backButton } = usePlatform();
  const backRef = useRef(handleNavigateBack);
  backRef.current = handleNavigateBack;
  useEffect(() => {
    if (!capabilities?.hasBackButton) return;
    backButton?.show(() => backRef.current());
    return () => backButton?.hide();
  }, [capabilities?.hasBackButton, backButton]);

  const handleSuccess = useCallback(() => {
    // returnTo arrives via query string — validate as an in-app path before
    // navigate(), otherwise an absolute or encoded URL produces ugly
    // path artefacts in the URL bar. The validator returns '/' for invalid
    // input; treat that case as "no returnTo" and use the /balance default.
    const safe = getSafeRedirectPath(returnTo);
    navigate(returnTo && safe !== '/' ? safe : '/balance', { replace: true });
  }, [navigate, returnTo]);

  // Keyboard: Escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleNavigateBack();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigateBack]);

  // Auto-redirect when success notification appears (e.g., balance topped up via WebSocket)
  useCloseOnSuccessNotification(handleSuccess);

  const getInitialAmount = (): string => {
    if (!initialAmountRubles || initialAmountRubles <= 0) return '';
    const converted = convertAmount(initialAmountRubles);
    return targetCurrency === 'IRR' || targetCurrency === 'RUB'
      ? Math.ceil(converted).toString()
      : converted.toFixed(2);
  };

  const initialDisplayAmount = getInitialAmount();
  const userEmail = useAuthStore((state) => state.user?.email);
  const userBalanceRubles = useAuthStore((state) => state.user?.balance_rubles ?? null);
  const [paymentEmail, setPaymentEmail] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const customerEmail = paymentEmail ?? userEmail ?? '';
  const [amount, setAmount] = useState(initialDisplayAmount);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(
    getPreferredOptionId(method?.options),
  );
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // Canonical RUB amount when the user picked a quick-amount chip. The input shows a
  // rounded display-currency value; validating/charging the canonical RUB avoids the FX
  // round-trip that could push a min-amount chip just below the allowed minimum. Cleared
  // as soon as the user edits the field by hand.
  const [quickRub, setQuickRub] = useState<number | null>(null);

  // Once methods have loaded, redirect to method selection if this method id is unknown.
  useEffect(() => {
    if (methods && !method) {
      const params = new URLSearchParams();
      const amount = searchParams.get('amount');
      const rt = searchParams.get('returnTo');
      if (amount) params.set('amount', amount);
      if (rt) params.set('returnTo', rt);
      const qs = params.toString();
      navigate(`/balance/top-up${qs ? `?${qs}` : ''}`, { replace: true });
    }
  }, [methods, method, navigate, searchParams]);

  useEffect(() => {
    if (!method?.options || method.options.length === 0) {
      if (selectedOption !== null) {
        setSelectedOption(null);
      }
      return;
    }

    const optionExists = method.options.some((option) => option.id === selectedOption);
    if (!optionExists) {
      setSelectedOption(getPreferredOptionId(method.options));
    }
  }, [method?.id, method?.options, selectedOption]);

  const starsPaymentMutation = useMutation({
    mutationFn: (amountKopeks: number) => balanceApi.createStarsInvoice(amountKopeks),
    onSuccess: async (data) => {
      if (!data.invoice_url) {
        setError(t('balance.errors.noPaymentLink'));
        return;
      }
      try {
        const status = await openInvoice(data.invoice_url);
        if (status === 'paid') {
          haptic.notification('success');
          setError(null);
          handleSuccess();
        } else if (status === 'failed') {
          haptic.notification('error');
          setError(t('wheel.starsPaymentFailed'));
        }
      } catch (e) {
        setError(t('balance.errors.generic', { details: String(e) }));
      }
    },
    onError: (err: unknown) => {
      haptic.notification('error');
      setError(getApiErrorMessage(err, t('balance.errors.invoiceFailed')));
    },
  });

  const topUpMutation = useMutation<
    {
      payment_id: string;
      payment_url?: string;
      invoice_url?: string;
      amount_kopeks: number;
      amount_rubles: number;
      status: string;
      expires_at: string | null;
      qr_payload?: string | null;
    },
    unknown,
    number
  >({
    mutationFn: (amountKopeks: number) => {
      if (!method) throw new Error('Method not loaded');
      if (method.id === 'antilopay') {
        return balanceApi.createTopUp(
          amountKopeks,
          method.id,
          selectedOption || undefined,
          customerEmail.trim(),
        );
      }
      return balanceApi.createTopUp(amountKopeks, method.id, selectedOption || undefined);
    },
    onSuccess: (data) => {
      const redirectUrl = data.payment_url || data.invoice_url;
      if (redirectUrl) {
        // Save payment info for the result page (do BEFORE possible redirect,
        // иначе после window.location.href этот код не выполнится).
        if (method && data.payment_id) {
          const methodKey = method.id.toLowerCase().replace(/-/g, '_');
          const displayName =
            method.name || t(`balance.paymentMethods.${methodKey}.name`, { defaultValue: '' });
          saveTopUpPendingInfo({
            amount_kopeks: data.amount_kopeks,
            method_id: method.id,
            method_name: displayName,
            payment_id: data.payment_id,
            created_at: Date.now(),
          });
        }

        // open_url_direct: seamless флоу как при покупке подарка.
        // window.location.href внутри Telegram MiniApp WebView навигирует
        // в том же контейнере без открытия внешнего браузера. После
        // оплаты return_url возвращает на /balance/top-up/result.
        //
        // t.me/ URL (Telegram Stars, CryptoBot) — всегда через нативный
        // handler (openInvoice / openTelegramLink в setPaymentUrl-ветке).
        // Stars уже отбит раньше через starsPaymentMutation, здесь — защита
        // на случай CryptoBot и других Telegram-deep-link провайдеров.
        // toLowerCase для устойчивости к редким провайдерам, которые могут вернуть
        // URL в нестандартном регистре. Также покрываем tg:// scheme на всякий случай.
        const lowerUrl = redirectUrl.toLowerCase();
        const isTelegramDeepLink =
          lowerUrl.startsWith('https://t.me/') ||
          lowerUrl.startsWith('http://t.me/') ||
          lowerUrl.startsWith('tg://');
        // Свой экран оплаты: QR показываем здесь же — уводить на страницу провайдера незачем.
        if (data.qr_payload) {
          setQrPayload(data.qr_payload);
          setPaymentUrl(redirectUrl);
          return;
        }

        if (method?.open_url_direct && !isTelegramDeepLink) {
          // In the Telegram WebView, same-container navigation to the provider page breaks
          // when it hands off to a bank app via a custom scheme (SBP) — Android shows
          // ERR_UNKNOWN_URL_SCHEME, iOS opens nothing (bug #654272). Open externally there;
          // on web keep same-tab navigation.
          openPaymentUrl(redirectUrl, platform, openLink);
          return;
        }

        setPaymentUrl(redirectUrl);
      }
    },
    onError: (err: unknown) => {
      const detail = getApiErrorMessage(err, '');
      setError(
        detail.includes('not yet implemented') ? t('balance.useBot') : detail || t('common.error'),
      );
    },
  });

  // Auto-focus input (only on desktop — mobile keyboard hides bottom nav)
  useEffect(() => {
    if (platform === 'telegram') return;
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [platform]);

  // Spinner only while methods are actually loading. Once the query has resolved without
  // this method, the redirect effect above navigates away (so we render nothing here rather
  // than spinning forever on a cold cache).
  if (!method) {
    if (!isMethodsLoading) {
      return null;
    }
    return (
      <Page>
        <PageHeader title={t('balance.topUpBalance')} backTo="/balance/top-up" />
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      </Page>
    );
  }

  const hasOptions = method.options && method.options.length > 0;
  const orderedOptions = sortOptionsWithSbpFirst(method.options);
  // Другие доступные способы оплаты для блока «Попробуйте другой способ».
  const alternativeMethods = (methods ?? [])
    .filter((m) => m.id !== methodId && m.is_available)
    .slice(0, 5);

  const alternativeMethodName = (m: { id: string; name: string }) => {
    const key = m.id.toLowerCase().replace(/-/g, '_');
    return t(`balance.paymentMethods.${key}.name`, { defaultValue: '' }) || m.name;
  };

  const goToAlternativeMethod = (id: string) => {
    const typed = parseFloat(amount);
    const rubles = quickRub ?? (Number.isNaN(typed) || typed <= 0 ? null : convertToRub(typed));
    const qs = rubles
      ? `?amount=${encodeURIComponent(String(Math.round(rubles * 100) / 100))}`
      : '';
    navigate(`/balance/top-up/${id}${qs}`);
  };

  const selectedOptionMinimum =
    method.options?.find((option) => option.id === selectedOption)?.min_amount_kopeks ?? 0;
  const minRubles = Math.max(method.min_amount_kopeks, selectedOptionMinimum) / 100;
  const maxRubles = method.max_amount_kopeks / 100;
  const methodKey = method.id.toLowerCase().replace(/-/g, '_');
  const isStarsMethod = methodKey.includes('stars');
  const methodName =
    method.name || t(`balance.paymentMethods.${methodKey}.name`, { defaultValue: '' });

  const handleSubmit = () => {
    setError(null);
    setPaymentUrl(null);
    setQrPayload(null);
    inputRef.current?.blur();
    if (
      method.id === 'antilopay' &&
      (!customerEmail.trim() || !emailRef.current?.checkValidity())
    ) {
      setError(t('balance.paymentEmailInvalid'));
      emailRef.current?.focus();
      return;
    }

    if (!checkRateLimit(RATE_LIMIT_KEYS.PAYMENT, 3, 30000)) {
      setError(
        t('balance.errors.rateLimit', { seconds: getRateLimitResetTime(RATE_LIMIT_KEYS.PAYMENT) }),
      );
      return;
    }
    if (hasOptions && !selectedOption) {
      setError(t('balance.errors.selectMethod'));
      return;
    }
    const amountCurrency = parseFloat(amount);
    if (isNaN(amountCurrency) || amountCurrency <= 0) {
      setError(t('balance.errors.enterAmount'));
      return;
    }
    const amountRubles = convertToRub(amountCurrency);

    // Resolve the canonical RUB amount. Prefer an exact source — an unedited prefill or a
    // quick-amount chip — over the display value, whose FX round-trip rounding (e.g. 150₽ at
    // rate 90.66 → "1.65" USD → back to 149.59₽) could push a min selection just below the
    // allowed minimum and block the top-up. quickRub is cleared on any manual edit, so a
    // non-null value means the field still holds that chip's exact amount.
    const userEditedAmount = amount.trim() !== initialDisplayAmount.trim();
    const usingPrefill = !userEditedAmount && !!initialAmountRubles && initialAmountRubles > 0;
    const usingQuick = quickRub !== null;

    let canonicalRubles = amountRubles;
    if (usingPrefill) {
      canonicalRubles = initialAmountRubles as number;
    } else if (usingQuick && quickRub !== null) {
      canonicalRubles = quickRub;
    } else if (targetCurrency !== 'RUB') {
      // Hand-typed non-RUB amount: snap up to the minimum when it lands within one
      // display-currency rounding step below it, so typing the advertised (rounded)
      // minimum isn't rejected by FX rounding.
      const decimals = targetCurrency === 'IRR' ? 0 : 2;
      const roundingStep = convertToRub(10 ** -decimals);
      if (canonicalRubles < minRubles && canonicalRubles >= minRubles - roundingStep) {
        canonicalRubles = minRubles;
      }
    }

    if (canonicalRubles < minRubles || canonicalRubles > maxRubles) {
      setError(t('balance.errors.amountRange', { min: minRubles, max: maxRubles }));
      return;
    }

    // Round exact sources; ceil genuine fractional kopeks for hand-typed FX amounts.
    // Remove only floating-point noise at this magnitude (e.g. 6407.000000000001).
    const kopeks = canonicalRubles * 100;
    const amountKopeks =
      targetCurrency === 'RUB' || usingPrefill || usingQuick
        ? Math.round(kopeks)
        : Math.ceil(kopeks - Number.EPSILON * Math.abs(kopeks));
    if (isStarsMethod) {
      starsPaymentMutation.mutate(amountKopeks);
    } else {
      topUpMutation.mutate(amountKopeks);
    }
  };

  const quickAmounts = (
    method.quick_amounts != null
      ? method.quick_amounts.map((kopeks) => kopeks / 100)
      : [100, 300, 500, 1000]
  ).filter((a) => a >= minRubles && a <= maxRubles);
  const currencyDecimals = targetCurrency === 'IRR' || targetCurrency === 'RUB' ? 0 : 2;
  const getQuickValue = (rub: number) =>
    targetCurrency === 'IRR'
      ? Math.round(convertAmount(rub)).toString()
      : convertAmount(rub).toFixed(currencyDecimals);
  const isPending = topUpMutation.isPending || starsPaymentMutation.isPending;

  const handleOpenPayment = () => {
    if (!paymentUrl) return;
    if (paymentUrl.includes('t.me/')) {
      openTelegramLink(paymentUrl);
    } else {
      openLink(paymentUrl);
    }
  };

  const handleCopyUrl = async () => {
    if (!paymentUrl) return;
    try {
      await copyToClipboard(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed silently
    }
  };

  const amountNumber = parseFloat(amount);
  const canSubmit = !isPending && !!amount && amountNumber > 0;
  const methodTitle = methodName.replace(/^(?:\p{Extended_Pictographic}|️|‍|\s)+/u, '').trim();
  // Итог: сколько станет на балансе. Только когда сумма введена и баланс известен.
  const amountRubForSummary =
    quickRub ??
    (Number.isNaN(amountNumber) || amountNumber <= 0 ? null : convertToRub(amountNumber));
  const balanceAfter =
    userBalanceRubles != null && amountRubForSummary != null && amountRubForSummary > 0
      ? userBalanceRubles + amountRubForSummary
      : null;

  return (
    <Page>
      {/* «Назад» на странице есть всегда; в Telegram дополнительно работает нативная (см. выше). */}
      <PageHeader title={t('balance.topUpBalance')} backTo="/balance/top-up" />

      {/* Выбранный способ */}
      <Group>
        <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
          <PaymentMethodIcon method={spofyPaymentIcon(method.id)} className="h-10 w-10 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-dark-100">
              {methodTitle}
            </span>
            <span className="mt-0.5 block text-[13px] text-dark-400">
              {formatAmount(minRubles, 0)}
              {' – '}
              {formatAmount(maxRubles, 0)}
              {' '}
              {currencySymbol}
            </span>
          </span>
          <Button
            tone="ghost"
            className="h-9 shrink-0 px-3 text-[13px]"
            onClick={handleNavigateBack}
          >
            {t('balance.changeMethod')}
          </Button>
        </div>
      </Group>

      {/* Варианты внутри способа (СБП / карта) — сегментом */}
      {hasOptions && orderedOptions.length > 0 && (
        <section>
          <SectionTitle>{t('balance.paymentMethod')}</SectionTitle>
          <div className="flex rounded-2xl bg-dark-900/70 p-1 ring-1 ring-inset ring-dark-800/80">
            {orderedOptions.map((opt) => {
              const active = selectedOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedOption(opt.id)}
                  className={cn(
                    'h-10 min-w-0 flex-1 truncate rounded-xl px-3 text-[13px] font-semibold transition-colors',
                    active
                      ? 'bg-dark-700 text-dark-50 shadow-sm'
                      : 'text-dark-400 hover:text-dark-200',
                  )}
                >
                  {opt.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {method.id === 'antilopay' && (
        <Surface>
          <label
            htmlFor="payment-email"
            className="block px-1 text-[13px] font-semibold text-dark-400"
          >
            {t('balance.paymentEmail')}
          </label>
          <input
            ref={emailRef}
            id="payment-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            value={customerEmail}
            onChange={(event) => {
              setPaymentEmail(event.target.value);
              setError(null);
            }}
            aria-describedby="payment-email-help"
            className="mt-2 h-12 w-full rounded-2xl bg-dark-800/60 px-4 text-[15px] text-dark-50 ring-1 ring-inset ring-dark-700/60 placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-500/60"
          />
          <p id="payment-email-help" className="mt-2 px-1 text-[13px] leading-snug text-dark-400">
            {t('balance.paymentEmailHelp')}
          </p>
        </Surface>
      )}

      {/* Сумма */}
      <Surface>
        <label
          htmlFor="topup-amount"
          className="block px-1 text-[13px] font-semibold text-dark-400"
        >
          {t('balance.enterAmount')}
        </label>
        <div
          className={cn(
            'relative mt-2 rounded-2xl bg-dark-800/60 transition-shadow',
            isInputFocused
              ? 'ring-2 ring-inset ring-accent-500/60'
              : 'ring-1 ring-inset ring-dark-700/60',
          )}
        >
          <input
            id="topup-amount"
            ref={inputRef}
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuickRub(null);
            }}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="0"
            className="h-14 w-full bg-transparent px-4 pr-12 text-[26px] font-bold tracking-tight text-dark-50 placeholder:text-dark-600 focus:outline-none"
            autoComplete="off"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-dark-400">
            {currencySymbol}
          </span>
        </div>

        {quickAmounts.length > 0 && (
          <div
            className={cn(
              'mt-3 grid gap-2',
              // Без одинокой кнопки на второй строке: 5 — в ряд, 6 — 3×2.
              (
                {
                  1: 'grid-cols-1',
                  2: 'grid-cols-2',
                  3: 'grid-cols-3',
                  5: 'grid-cols-5',
                  6: 'grid-cols-3',
                } as Record<number, string>
              )[quickAmounts.length] ?? 'grid-cols-4',
            )}
          >
            {quickAmounts.map((a) => {
              const val = getQuickValue(a);
              const isSelected = amount === val;
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setAmount(val);
                    setQuickRub(a);
                    inputRef.current?.blur();
                    if (
                      method.id === 'antilopay' &&
                      (!customerEmail.trim() || !emailRef.current?.checkValidity())
                    ) {
                      setError(t('balance.paymentEmailInvalid'));
                      emailRef.current?.focus();
                      return;
                    }
                  }}
                  className={cn(
                    'h-10 min-w-0 truncate rounded-xl px-1 text-[13px] font-semibold transition-colors',
                    isSelected
                      ? 'bg-accent-500/15 text-accent-400 ring-1 ring-inset ring-accent-500/50'
                      : 'bg-dark-800/60 text-dark-200 hover:bg-dark-800',
                  )}
                >
                  {formatAmount(a, 0)}
                  {' '}
                  {currencySymbol}
                </button>
              );
            })}
          </div>
        )}

        {balanceAfter != null && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-dark-800/70 px-1 pt-3 text-[13px]">
            <span className="text-dark-400">{t('balance.afterTopUp', 'Станет на балансе')}</span>
            <span className="whitespace-nowrap font-semibold text-dark-100">
              {formatAmount(balanceAfter, 0)}
              {' '}
              {currencySymbol}
            </span>
          </div>
        )}
      </Surface>

      {/* Оплатить */}
      <Button
        // Когда ссылка уже готова, главная кнопка — «Открыть страницу оплаты» ниже.
        tone={paymentUrl ? 'secondary' : 'primary'}
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full"
      >
        {isPending ? (
          <span
            aria-hidden
            className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : canSubmit ? (
          t('balance.topUpFor', {
            amount: `${formatAmount(amountNumber, 0)} ${currencySymbol}`,
          })
        ) : (
          t('balance.topUp')
        )}
      </Button>

      {/* Ошибка и «Попробуйте другой способ»: те же деньги можно внести иначе (как в боте) */}
      {error && (
        <Surface className="space-y-3">
          <p
            role="alert"
            className="flex items-start gap-2 text-[13px] leading-snug text-error-400"
          >
            <PiWarningCircleDuotone className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
            {error}
          </p>
          {alternativeMethods.length > 0 && (
            <>
              <p className="text-[13px] font-semibold text-dark-300">
                {t('balance.errors.tryAnotherMethod')}
              </p>
              <div className="flex flex-wrap gap-2">
                {alternativeMethods.map((alt) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => goToAlternativeMethod(alt.id)}
                    className="flex h-10 items-center gap-2 rounded-xl bg-dark-800/60 pl-1.5 pr-3 text-[13px] font-semibold text-dark-100 ring-1 ring-inset ring-dark-700/60 transition-colors hover:bg-dark-800"
                  >
                    <PaymentMethodIcon
                      method={spofyPaymentIcon(alt.id)}
                      className="h-7 w-7 shrink-0"
                    />
                    {alternativeMethodName(alt).replace(
                      /^(?:\p{Extended_Pictographic}|️|‍|\s)+/u,
                      '',
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </Surface>
      )}

      {/* Ссылка на оплату готова */}
      {paymentUrl && (
        <Surface className="space-y-4">
          <div className="flex items-center gap-3">
            <RowIcon tone="success">
              <PiCheckCircleDuotone />
            </RowIcon>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-dark-100">{t('balance.paymentReady')}</p>
              {!qrPayload && (
                <p className="mt-0.5 text-[13px] leading-snug text-dark-400">
                  {t('balance.clickToOpenPayment')}
                </p>
              )}
            </div>
          </div>

          {qrPayload && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-white p-3" data-testid="topup-qr">
                <QRCodeSVG value={qrPayload} size={192} level="M" includeMargin={false} />
              </div>
              <p className="text-center text-[13px] leading-snug text-dark-400">
                {t(
                  'balance.scanQrToPay',
                  'Отсканируйте QR-код в приложении банка или откройте оплату',
                )}
              </p>
            </div>
          )}

          <Button onClick={handleOpenPayment} className="w-full">
            <PiArrowSquareOutBold className="h-[18px] w-[18px]" aria-hidden />
            {t('balance.openPaymentPage')}
          </Button>

          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-xl bg-dark-800/60 px-3 py-2.5 ring-1 ring-inset ring-dark-700/60">
              <p className="truncate text-xs text-dark-400">{paymentUrl}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              aria-label={t('common.copy')}
              title={t('common.copy')}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                copied
                  ? 'bg-success-500/15 text-success-400'
                  : 'bg-dark-800/60 text-dark-300 hover:bg-dark-800 hover:text-dark-100',
              )}
            >
              {copied ? <PiCheckBold className="h-5 w-5" /> : <PiCopyDuotone className="h-5 w-5" />}
            </button>
          </div>
        </Surface>
      )}
    </Page>
  );
}
