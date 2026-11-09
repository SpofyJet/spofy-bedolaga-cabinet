import { isLifetimeEndDate } from '@/utils/lifetime';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  PiArrowCircleUpDuotone,
  PiCalendarDuotone,
  PiCheckBold,
  PiClockDuotone,
  PiCoinsDuotone,
  PiCopyDuotone,
  PiGiftDuotone,
  PiHandshakeDuotone,
  PiHourglassDuotone,
  PiPercentDuotone,
  PiShareNetworkDuotone,
  PiShoppingBagDuotone,
  PiTelegramLogoDuotone,
  PiUserDuotone,
  PiUserPlusDuotone,
  PiUsersThreeDuotone,
  PiWalletDuotone,
  PiWarningCircleDuotone,
} from 'react-icons/pi';
import { referralApi, type ReferralEarning } from '../api/referral';
import type { ReferralDaysTargetOption, ReferralTerms } from '../types';
import { usePlatform } from '../platform';
import { copyToClipboard } from '../utils/clipboard';
import { brandingApi } from '../api/branding';
import { partnerApi } from '../api/partners';
import { withdrawalApi } from '../api/withdrawals';
import { CampaignCard } from '../components/partner/CampaignCard';
import { useCurrency } from '../hooks/useCurrency';
import { formatPriceShort } from '../utils/format';
import { plainTariffName } from '../utils/plainTariffName';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Button,
  Chip,
  EmptyState,
  Group,
  Page,
  Row,
  RowIcon,
  SectionTitle,
  Stat,
  Surface,
} from '@/components/spofy/ui';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Tone = 'accent' | 'success' | 'warning' | 'error' | 'muted';

function withdrawalStatusTone(status: string): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'approved':
      return 'accent';
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'cancelled':
      return 'error';
    default:
      return 'muted';
  }
}

/** Вариант выбора: кружок-радио слева, подпись, необязательная подсказка. */
function ChoiceButton({
  selected,
  disabled,
  onClick,
  icon,
  label,
  hint,
  hintStrong,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  hint?: string;
  hintStrong?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors disabled:opacity-60',
        selected ? 'bg-accent-500/10' : 'bg-dark-800/40 hover:bg-dark-800/70',
      )}
    >
      {icon ? (
        <RowIcon tone={selected ? 'accent' : 'muted'}>{icon}</RowIcon>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
            selected ? 'bg-accent-500/20' : 'bg-dark-700',
          )}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-accent-400" />}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-dark-100">{label}</span>
        {hint && (
          <span
            className={cn(
              'mt-0.5 block text-[13px] leading-snug',
              hintStrong ? (selected ? 'text-accent-300' : 'text-dark-300') : 'text-dark-400',
            )}
          >
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * What the user chose: the form of the reward and where the days land.
 *
 * Rendered only for the parts an administrator allowed — a control that changes
 * nothing promises an influence it does not have. Each option shows whether it is
 * the one in force, because a settings screen that does not say what is selected
 * makes people guess.
 *
 * Exported for tests: mounting the whole page needs a dozen mocks, and the part
 * worth checking is this one.
 */
export function RewardSettings({
  terms,
  onChange,
  pending = false,
}: {
  terms: ReferralTerms;
  onChange: (payload: {
    reward_preference?: string | null;
    days_target_subscription_id?: number | null;
    set_reward_preference?: boolean;
    set_days_target?: boolean;
  }) => void;
  pending?: boolean;
}) {
  const { t } = useTranslation();
  const kindChoice = terms.allow_reward_kind_choice === true;
  const targetChoice = terms.allow_days_target_choice === true;
  if (!kindChoice && !targetChoice) return null;

  const options = terms.days_target_options ?? [];
  // Выбор двоичный: деньги ИЛИ дни. Не выбиравший получает деньги — так же, как
  // их выдаст расчёт, поэтому и отмечены они, а не «ничего не выбрано».
  const kinds = [
    {
      value: 'money',
      label: t('referral.rewardSettings.kindMoney'),
      // Сумма важнее общей фразы: без неё выбор делается вслепую — непонятно,
      // от чего отказываешься. Общая фраза остаётся, когда суммы нет.
      hint: terms.reward_choice_money || t('referral.rewardSettings.kindMoneyHint'),
      amount: Boolean(terms.reward_choice_money),
      icon: <PiCoinsDuotone />,
    },
    {
      value: 'days',
      label: t('referral.rewardSettings.kindDays'),
      hint: terms.reward_choice_days || t('referral.rewardSettings.kindDaysHint'),
      amount: Boolean(terms.reward_choice_days),
      icon: <PiCalendarDuotone />,
    },
  ];
  const currentKind = terms.reward_preference === 'days' ? 'days' : 'money';

  const optionLabel = (option: ReferralDaysTargetOption) => {
    const name = option.tariff_name || t('referral.rewardSettings.subscription');
    if (!option.end_date) return name;
    if (isLifetimeEndDate(option.end_date))
      return `${name} — ${t('subscription.lifetime.forever')}`;
    const until = t('referral.rewardSettings.until', {
      date: new Date(option.end_date).toLocaleDateString(),
    });
    return `${name} — ${until}`;
  };

  return (
    <section>
      <SectionTitle>{t('referral.rewardSettings.title')}</SectionTitle>
      <Surface className="space-y-5">
        <p className="text-[13px] leading-snug text-dark-400">
          {t('referral.rewardSettings.intro')}
        </p>

        {kindChoice && (
          <div>
            <h3 className="text-[15px] font-semibold text-dark-100">
              {t('referral.rewardSettings.kindHeader')}
            </h3>
            <p className="mt-0.5 text-[13px] text-dark-400">
              {t('referral.rewardSettings.kindHint')}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {kinds.map((kind) => (
                <ChoiceButton
                  key={kind.value}
                  selected={currentKind === kind.value}
                  disabled={pending}
                  onClick={() =>
                    onChange({ reward_preference: kind.value, set_reward_preference: true })
                  }
                  icon={kind.icon}
                  label={kind.label}
                  hint={kind.hint}
                  hintStrong={kind.amount}
                />
              ))}
            </div>
          </div>
        )}

        {/* Куда класть дни спрашиваем, только когда человек выбрал дни: выбравшему
            деньги эта настройка ни на что не влияет, и раздел обещал бы влияние,
            которого нет. Если выбор вида админ не разрешил, спрашиваем всегда —
            дни тогда приходят по правилу, и цель у них есть. */}
        {targetChoice && (!kindChoice || currentKind === 'days') && (
          <div>
            <h3 className="text-[15px] font-semibold text-dark-100">
              {t('referral.rewardSettings.targetHeader')}
            </h3>
            <p className="mt-0.5 text-[13px] text-dark-400">
              {t('referral.rewardSettings.targetHint')}
            </p>
            {options.length === 0 ? (
              <p className="mt-3 text-[13px] text-dark-400">
                {t('referral.rewardSettings.targetNone')}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {/* Автоподбор — тоже вариант, и он обязан быть виден как выбранный:
                    иначе непонятно, что происходит сейчас. */}
                <ChoiceButton
                  selected={(terms.days_target_subscription_id ?? null) === null}
                  disabled={pending}
                  onClick={() =>
                    onChange({ days_target_subscription_id: null, set_days_target: true })
                  }
                  label={t('referral.rewardSettings.targetAuto')}
                />
                {options.map((option) => (
                  <ChoiceButton
                    key={option.id}
                    selected={terms.days_target_subscription_id === option.id}
                    disabled={pending}
                    onClick={() =>
                      onChange({ days_target_subscription_id: option.id, set_days_target: true })
                    }
                    label={optionLabel(option)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Surface>
    </section>
  );
}

/**
 * Programme terms under the `levels` scheme.
 *
 * Exported so the card can be tested on its own: mounting the whole Referral page
 * needs a dozen mocks, and the part worth checking is this one — whether the card
 * states which mode is in force and marks the level the viewer is actually on.
 */
export function ProgrammeTerms({ terms }: { terms: ReferralTerms }) {
  const { t } = useTranslation();
  const isTiers = terms.levels_mode === 'tiers';
  const levels = terms.levels ?? [];
  // Строки-описания остаются запасным путём: они приходят из того же источника
  // и покрывают старый сервер, который ещё не отдаёт разбор по частям.
  const fallbackLines = terms.level_descriptions ?? [];
  const progress = tierProgressText(terms, t);

  return (
    <section>
      <SectionTitle>{t('referral.terms.title')}</SectionTitle>
      <Surface className="space-y-3">
        {/* Правило режима — одной фразой над лестницей. Без неё список
            уровней в режиме «за приглашённых» читается как складывающиеся
            награды, а в цепочке — наоборот, как выбор одной из них. */}
        <p className="text-[13px] leading-snug text-dark-400">
          {isTiers ? t('referral.terms.modeTiers') : t('referral.terms.modeChain')}
        </p>

        {levels.length > 0 ? (
          <ol className="space-y-2">
            {levels.map((lvl) => (
              <li
                key={lvl.level}
                className={cn(
                  'rounded-2xl p-3',
                  lvl.is_current ? 'bg-accent-500/10' : 'bg-dark-800/40',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-sm font-semibold',
                      lvl.is_current ? 'bg-accent-500 text-on-accent' : 'bg-dark-700 text-dark-200',
                    )}
                  >
                    {lvl.level}
                  </span>
                  <span className="text-[15px] font-semibold text-dark-100">
                    {t('referral.terms.levelLabel', { level: lvl.level })}
                  </span>
                  {lvl.is_current && <Chip>{t('referral.terms.currentBadge')}</Chip>}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {lvl.pays_referrer ? (
                    lvl.rewards.map((reward) => (
                      <Chip key={reward} tone="success">
                        {reward}
                      </Chip>
                    ))
                  ) : (
                    <Chip tone="muted">{t('referral.terms.paysNothing')}</Chip>
                  )}
                  {lvl.pays_referrer && lvl.trigger_label && (
                    <span className="text-xs text-dark-400">{lvl.trigger_label}</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dark-400">
                  {/* Условие показывается только там, где оно есть смысл: в
                      цепочке уровень открывается порогом, а в режиме за
                      приглашённых порог и определяет, какой уровень ваш. */}
                  <span>
                    {lvl.required_referrals > 0
                      ? lvl.required_referrals_active_only
                        ? t('referral.terms.fromActive', { count: lvl.required_referrals })
                        : t('referral.terms.fromAny', { count: lvl.required_referrals })
                      : t('referral.terms.startingLevel')}
                  </span>
                  {lvl.referee_reward && (
                    <span>{t('referral.terms.refereeGets', { reward: lvl.referee_reward })}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : fallbackLines.length > 0 ? (
          <ul className="space-y-2">
            {fallbackLines.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-dark-200">
                <span aria-hidden="true" className="mt-1 text-accent-400">
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-dark-400">{t('referral.terms.noLevels')}</p>
        )}

        {terms.personal_percent != null && (
          <p className="rounded-2xl bg-warning-500/10 p-3 text-sm text-warning-300">
            {t('referral.terms.personalRate', { percent: terms.personal_percent })}
          </p>
        )}

        {progress && <p className="text-sm text-dark-300">{progress}</p>}
      </Surface>
    </section>
  );
}

/**
 * The rank line under the programme terms, or null when there is nothing to say.
 *
 * Three states, and only two of them produce text: no rank reached yet, and a
 * rank with a next step ahead. A partner standing on the TOP rank has no next
 * step — rendering an empty paragraph for them left a stray margin on the one
 * screen that should read as "you are done climbing".
 *
 * Under `chain` there are no ranks at all, so nothing is shown: the server sends
 * tier_current_level = null there, and a naive check would tell every single user
 * "no rank reached yet" about a concept that does not exist in their programme.
 *
 * Exported for tests: the decision is worth checking on its own, without
 * mounting the whole page.
 */
export function tierProgressText(
  terms: Pick<
    ReferralTerms,
    'levels_mode' | 'tier_current_level' | 'tier_next_level' | 'tier_next_remaining'
  >,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (terms.levels_mode !== 'tiers') return null;
  if (terms.tier_current_level == null) return t('referral.terms.tierNone');
  if (terms.tier_next_level == null) return null;
  return t('referral.terms.tierNext', {
    level: terms.tier_next_level,
    count: terms.tier_next_remaining ?? 0,
  });
}

/** Ссылка в рамке: текст обрезается, кнопка копирования справа. */
function LinkField({
  icon,
  label,
  value,
  copied,
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  copied?: boolean;
  /** Без onCopy поле только показывает ссылку — копирование кнопкой ниже. */
  onCopy?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-medium text-dark-400 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        {label}
      </div>
      <div className="flex min-h-12 items-center gap-2 rounded-2xl bg-dark-800/60 py-1.5 pl-4 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-sm text-dark-100" title={value}>
          {value}
        </span>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            disabled={!value}
            aria-label={copied ? t('referral.copied') : t('referral.copyLink')}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50',
              copied
                ? 'bg-success-500/15 text-success-400'
                : 'bg-dark-700/60 text-dark-200 hover:bg-dark-700',
            )}
          >
            {copied ? (
              <PiCheckBold className="h-4 w-4" />
            ) : (
              <PiCopyDuotone className="h-[18px] w-[18px]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Дни, которые бот начисляет обоим, когда друг впервые подключил VPN (trial_quest_service, DAYS_FRIEND).
const FRIEND_DAYS = 2;

export default function Referral() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // useCurrency остаётся ради курса: formatPriceShort берёт его из общего кэша.
  useCurrency();
  // Суммы целыми рублями: «375 ₽», а не «375,00 ₽»; копейки — только если они есть.
  const money = useCallback((rubles: number) => formatPriceShort(Math.round(rubles * 100)), []);
  const plusMoney = useCallback((rubles: number) => `+${money(rubles)}`, [money]);
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState<'cabinet' | 'bot' | null>(null);
  const [rewardChoiceError, setRewardChoiceError] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const { data: info, isLoading } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  // Build referral link for cabinet registration
  const referralLink = info?.referral_code
    ? `${window.location.origin}/login?ref=${info.referral_code}`
    : '';
  const botReferralLink = info?.bot_referral_link || '';

  const rewardChoiceMutation = useMutation({
    mutationFn: referralApi.updateRewardChoice,
    // Ответ эндпоинта — те же условия целиком, поэтому кладём их в кэш сразу:
    // повторный запрос показал бы прежний выбор на долю секунды.
    onSuccess: (updated) => queryClient.setQueryData(['referral-terms'], updated),
    onError: () => setRewardChoiceError(t('referral.rewardSettings.saveError')),
  });

  const { data: terms } = useQuery({
    queryKey: ['referral-terms'],
    queryFn: referralApi.getReferralTerms,
  });

  const { data: referralList } = useQuery({
    queryKey: ['referral-list'],
    queryFn: () => referralApi.getReferralList({ per_page: 10 }),
  });

  const { data: earnings } = useQuery({
    queryKey: ['referral-earnings'],
    queryFn: () => referralApi.getReferralEarnings({ per_page: 10 }),
  });

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: brandingApi.getBranding,
    staleTime: 60000,
  });

  // Partner status query
  const { data: partnerStatus } = useQuery({
    queryKey: ['partner-status'],
    queryFn: partnerApi.getStatus,
  });

  const isPartner = partnerStatus?.partner_status === 'approved';

  // Withdrawal is available to any referrer: the backend endpoints
  // (/cabinet/referral/withdrawal/*) do not require partner_status, so the
  // section is gated only by the admin visibility flag.
  const withdrawalVisible = terms?.partner_section_visible !== false;

  const {
    data: withdrawalBalance,
    isPending: withdrawalBalancePending,
    isError: withdrawalBalanceFailed,
  } = useQuery({
    queryKey: ['withdrawal-balance'],
    queryFn: withdrawalApi.getBalance,
    enabled: withdrawalVisible,
  });

  const { data: withdrawalHistory } = useQuery({
    queryKey: ['withdrawal-history'],
    queryFn: withdrawalApi.getHistory,
    enabled: withdrawalVisible,
  });

  /*
   * Выключенный вывод показывать нечем: сервер обнуляет всю статистику, кнопка
   * навсегда серая, а под ней стоит служебная фраза «Функция вывода
   * реферального баланса отключена». Бот в этом случае просто не рисует кнопку —
   * кабинет теперь тоже убирает весь раздел.
   *
   * Кроме одного случая: заявки, поданные до выключения, никуда не деваются и
   * остаются видны — иначе человек потеряет из виду деньги, которые ещё в
   * обработке. Пока ответ не пришёл, раздела нет вовсе: иначе «История выводов»
   * успевает мигнуть у того, кому вывод вообще не положен. Если ответ не пришёл
   * совсем, показываем как раньше — молча прятать чужие деньги хуже.
   */
  const withdrawalEnabled = withdrawalBalance?.is_withdrawal_enabled ?? withdrawalBalanceFailed;
  /* Строго «знаем, что выключен»: пока ответа нет, текст не должен дёргаться. */
  const withdrawalTurnedOff = withdrawalBalance?.is_withdrawal_enabled === false;
  const hasWithdrawalHistory = (withdrawalHistory?.items?.length ?? 0) > 0;
  const withdrawalSectionVisible =
    withdrawalVisible && !withdrawalBalancePending && (withdrawalEnabled || hasWithdrawalHistory);

  // Withdrawal cancel mutation
  const cancelWithdrawalMutation = useMutation({
    mutationFn: withdrawalApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-balance'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawal-history'] });
    },
  });

  const isLevelsScheme = terms?.scheme === 'levels';
  const isTiersScheme = isLevelsScheme && terms?.levels_mode === 'tiers';

  /**
   * A reward can be money, subscription days, or both. Days carry
   * amount_kopeks = 0 by design, so formatting by the money amount alone renders
   * a real "+7 days" reward as "+0.00 ₽". Zero money is omitted next to days for
   * the same reason it is on the bot side: it reports the absence of something
   * this programme never promised.
   */
  const formatEarning = useCallback(
    (earning: ReferralEarning) => {
      const days = earning.days_granted ?? 0;
      const amount = earning.amount_rubles ?? 0;
      const daysLabel = days
        ? earning.tariff_name
          ? t('referral.daysWithTariff', {
              count: days,
              tariff: plainTariffName(earning.tariff_name),
            })
          : t('referral.days', { count: days })
        : '';

      if (days && !amount) return `+${daysLabel}`;
      if (days) return `${plusMoney(amount)} + ${daysLabel}`;
      return plusMoney(amount);
    },
    [plusMoney, t],
  );

  const programTerms = useMemo(() => {
    if (!terms) return null;

    // Под схемой `levels` плоские поля ниже не управляют ни одним начислением:
    // выплаты идут по таблице уровней. Показывать их как «условия программы»
    // значило бы обещать пользователю то, чего бот не платит.
    if (terms.scheme === 'levels') {
      return <ProgrammeTerms terms={terms} />;
    }

    return (
      <Group title={t('referral.terms.title')}>
        <Row
          icon={<PiGiftDuotone />}
          iconTone="friends"
          label={t('referral.friendDays.title', { days: FRIEND_DAYS })}
          description={t('referral.friendDays.short', {
            days: FRIEND_DAYS,
            defaultValue: 'Вам и другу, когда он впервые подключит VPN. Без ограничений',
          })}
        />
        <Row
          icon={<PiPercentDuotone />}
          iconTone="money"
          label={t('referral.terms.commission')}
          trailing={
            <span className="text-[15px] font-semibold text-dark-100">
              {terms.commission_percent}%
            </span>
          }
        />
        <Row
          icon={<PiCoinsDuotone />}
          iconTone="money"
          label={t('referral.terms.minTopup')}
          trailing={
            <span className="text-[15px] font-semibold text-dark-100">
              {formatPriceShort(terms.minimum_topup_kopeks)}
            </span>
          }
        />
        {terms.first_topup_bonus_kopeks > 0 && (
          <Row
            icon={<PiGiftDuotone />}
            iconTone="success"
            label={t('referral.terms.newUserBonus')}
            trailing={
              <span className="text-[15px] font-semibold text-success-400">
                {`+${formatPriceShort(terms.first_topup_bonus_kopeks)}`}
              </span>
            }
          />
        )}
        {terms.inviter_bonus_kopeks > 0 && (
          <Row
            icon={<PiUserPlusDuotone />}
            iconTone="success"
            label={t('referral.terms.inviterBonus')}
            trailing={
              <span className="text-[15px] font-semibold text-success-400">
                {`+${formatPriceShort(terms.inviter_bonus_kopeks)}`}
              </span>
            }
          />
        )}
      </Group>
    );
  }, [terms, t]);

  const copyLink = async (link: string, type: 'cabinet' | 'bot') => {
    if (!link) return;
    try {
      await copyToClipboard(link);
      setCopiedLink(type);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      // clipboard write failed silently
    }
  };

  const { openTelegramLink } = usePlatform();

  const shareLink = () => {
    if (!referralLink) return;
    // Under the levels scheme commission_percent governs nothing — payouts come
    // from the level table — so the invite must not name a rate. This text is what
    // the user forwards to a friend; a wrong number here is a promise made in their
    // name. The bot's own invite was fixed the same way.
    const botName = branding?.name || import.meta.env.VITE_APP_NAME || 'Cabinet';
    const shareText = isLevelsScheme
      ? terms?.referee_bonus_description
        ? t('referral.shareMessageBonus', { bonus: terms.referee_bonus_description, botName })
        : t('referral.shareMessagePlain', { botName })
      : t('referral.shareMessage', { percent: info?.commission_percent || 0, botName });

    if (navigator.share) {
      navigator
        .share({
          title: t('referral.title'),
          text: shareText,
          url: referralLink,
        })
        .catch(() => {});
      return;
    }

    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
      referralLink,
    )}&text=${encodeURIComponent(shareText)}`;
    openTelegramLink(telegramUrl);
  };

  if (isLoading) {
    return (
      <Page>
        <PageSkeleton titleWidth="w-40">
          <Skeleton variant="card" className="h-44 rounded-3xl" />
          <Skeleton variant="card" className="h-24 rounded-3xl" />
          <Skeleton variant="card" className="h-48 rounded-3xl" />
        </PageSkeleton>
      </Page>
    );
  }

  // Show disabled state if referral program is disabled
  if (terms && !terms.is_enabled) {
    return (
      <Page>
        <PageHeader title={t('referral.title')} noBack />
        <EmptyState icon={<PiUsersThreeDuotone />} title={t('referral.disabled')} />
      </Page>
    );
  }

  const partnerStatusValue = partnerStatus?.partner_status ?? 'none';
  const partnerVisible = terms?.partner_section_visible !== false;
  const showApplySection = partnerVisible && partnerStatusValue === 'none';
  const showPendingSection = partnerVisible && partnerStatusValue === 'pending';
  const showApprovedSection = partnerVisible && partnerStatusValue === 'approved';
  const showRejectedSection = partnerVisible && partnerStatusValue === 'rejected';
  const hasPartnerBlock =
    showApplySection || showPendingSection || showApprovedSection || showRejectedSection;

  // В схемах уровней процент ничего не решает — третьей цифрой идёт уровень
  // или глубина сети, в классической схеме процент уже есть в условиях.
  const levelStat = isTiersScheme
    ? {
        label: t('referral.stats.yourLevel'),
        value:
          (terms?.tier_current_level ?? null) === null
            ? t('referral.stats.levelNotReached')
            : String(terms?.tier_current_level),
      }
    : isLevelsScheme
      ? {
          // В режиме «за приглашённых» глубины сети не существует — цепочка не
          // обходится вовсе, поэтому глубина показывается только в цепочке.
          label: t('referral.stats.chainDepth'),
          value: t('referral.stats.levelsValue', { count: terms?.max_level_depth || 1 }),
        }
      : null;

  const withdrawalBreakdown = withdrawalBalance
    ? [
        {
          key: 'earned',
          icon: <PiCoinsDuotone />,
          label: t('referral.withdrawal.totalEarned'),
          kopeks: withdrawalBalance.total_earned,
        },
        {
          key: 'withdrawn',
          icon: <PiArrowCircleUpDuotone />,
          label: t('referral.withdrawal.withdrawn'),
          kopeks: withdrawalBalance.withdrawn,
        },
        {
          key: 'spent',
          icon: <PiShoppingBagDuotone />,
          label: t('referral.withdrawal.spent'),
          kopeks: withdrawalBalance.referral_spent,
        },
        {
          key: 'pending',
          icon: <PiHourglassDuotone />,
          label: t('referral.withdrawal.pending'),
          kopeks: withdrawalBalance.pending,
        },
      ].filter((line) => line.kopeks > 0)
    : [];

  return (
    <Page>
      <PageHeader title={t('referral.title')} noBack />

      {/* Ссылка-приглашение */}
      <Surface className="space-y-4">
        <div className="flex items-start gap-3">
          <RowIcon tone="friends">
            <PiUserPlusDuotone />
          </RowIcon>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-dark-100">
              {t('referral.invite.title', 'Пригласите друга')}
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-dark-400">
              {isLevelsScheme
                ? t('referral.shareHintLevels')
                : t('referral.shareHint', { percent: info?.commission_percent || 0 })}
            </p>
          </div>
        </div>

        <LinkField
          icon={<PiShareNetworkDuotone />}
          label={t('referral.cabinetLink')}
          value={referralLink}
        />
        {botReferralLink && (
          <LinkField
            icon={<PiTelegramLogoDuotone />}
            label={t('referral.botLink')}
            value={botReferralLink}
            copied={copiedLink === 'bot'}
            onCopy={() => copyLink(botReferralLink, 'bot')}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            tone="secondary"
            onClick={() => copyLink(referralLink, 'cabinet')}
            disabled={!referralLink}
            className="min-w-0 px-3"
          >
            {copiedLink === 'cabinet' ? (
              <PiCheckBold className="h-4 w-4 shrink-0 text-success-400" />
            ) : (
              <PiCopyDuotone className="h-5 w-5 shrink-0" />
            )}
            <span className="truncate">
              {copiedLink === 'cabinet' ? t('referral.copied') : t('referral.copyLink')}
            </span>
          </Button>
          <Button onClick={shareLink} disabled={!referralLink} className="min-w-0 px-3">
            <PiShareNetworkDuotone className="h-5 w-5 shrink-0" />
            <span className="truncate">{t('referral.shareButton')}</span>
          </Button>
        </div>
      </Surface>

      {/* Статистика */}
      <Surface>
        <div className={cn('grid gap-4', levelStat ? 'grid-cols-3' : 'grid-cols-2')}>
          <Stat
            label={t('referral.stats.invited', 'Приглашено')}
            value={info?.total_referrals || 0}
            hint={`${info?.active_referrals || 0} ${t('referral.stats.activeReferrals').toLowerCase()}`}
          />
          <Stat
            label={t('referral.stats.earned', 'Заработано')}
            value={info?.total_earnings_rubles ? plusMoney(info.total_earnings_rubles) : money(0)}
            hint={
              info?.total_earnings_days
                ? t('referral.stats.earnedDays', { count: info.total_earnings_days })
                : undefined
            }
          />
          {levelStat && <Stat label={levelStat.label} value={levelStat.value} />}
        </div>
      </Surface>

      {/* Условия */}
      {programTerms}

      {/* Reward Settings */}
      {terms && (
        <div>
          <RewardSettings
            terms={terms}
            pending={rewardChoiceMutation.isPending}
            onChange={(payload) => {
              setRewardChoiceError(null);
              rewardChoiceMutation.mutate(payload);
            }}
          />
          {/* Ошибка сохранения обязана быть видна: без неё нажатие выглядит
              принятым, а выбор остаётся прежним. */}
          {rewardChoiceError && (
            <p className="mt-2 rounded-2xl bg-error-500/10 p-3 text-sm text-error-400">
              {rewardChoiceError}
            </p>
          )}
        </div>
      )}

      {/* Referrals List */}
      {referralList?.items && referralList.items.length > 0 ? (
        <Group title={t('referral.yourReferrals')}>
          {referralList.items.map((ref) => (
            <Row
              key={ref.id}
              icon={<PiUserDuotone />}
              iconTone={ref.has_paid ? 'success' : 'muted'}
              label={ref.first_name || ref.username || t('referral.anonymousUser', { id: ref.id })}
              description={new Date(ref.created_at).toLocaleDateString(i18n.language)}
              trailing={
                ref.has_paid ? (
                  <Chip tone="success">{t('referral.status.paid')}</Chip>
                ) : (
                  <Chip tone="muted">{t('referral.status.pending')}</Chip>
                )
              }
            />
          ))}
        </Group>
      ) : (
        <section>
          <SectionTitle>{t('referral.yourReferrals')}</SectionTitle>
          <EmptyState icon={<PiUsersThreeDuotone />} title={t('referral.noReferrals')} />
        </section>
      )}

      {/* Earnings History */}
      {earnings?.items && earnings.items.length > 0 && (
        <Group title={t('referral.earningsHistory')}>
          {earnings.items.map((earning) => (
            // Начисление бывает длинным («+1 234,56 ₽ + 90 дн. «Тариф»»): оно
            // занимает не больше половины строки и переносится, имя — остаток.
            <Row
              key={earning.id}
              icon={(earning.days_granted ?? 0) > 0 ? <PiCalendarDuotone /> : <PiCoinsDuotone />}
              iconTone="success"
              label={
                earning.referral_first_name ||
                earning.referral_username ||
                t('referral.anonymousReferral')
              }
              description={
                <>
                  {t(`referral.reasons.${earning.reason}`, earning.reason)}
                  {(earning.level ?? 1) > 1 &&
                    ` • ${t('referral.levelBadge', { count: earning.level ?? 1 })}`}{' '}
                  • {new Date(earning.created_at).toLocaleDateString(i18n.language)}
                </>
              }
              trailing={
                <span className="min-w-0 max-w-[50%] text-right text-[15px] font-semibold text-success-400">
                  {formatEarning(earning)}
                </span>
              }
            />
          ))}
        </Group>
      )}

      {/* ==================== Партнёрство ==================== */}
      {hasPartnerBlock && (
        <Group title={t('referral.partner.sectionTitle', 'Партнёрство')}>
          {/* Status: none — Become a Partner CTA */}
          {showApplySection && (
            <Row
              icon={<PiHandshakeDuotone />}
              iconTone="friends"
              label={t('referral.partner.becomePartner')}
              description={
                /* Обещать вывод заработка, когда вывод выключен, нельзя: заявку
                   подадут ради того, чего не будет. */
                t(
                  withdrawalTurnedOff
                    ? 'referral.partner.becomePartnerDescNoWithdrawal'
                    : 'referral.partner.becomePartnerDesc',
                )
              }
              to="/referral/partner/apply"
            />
          )}

          {/* Status: pending — Application Under Review */}
          {showPendingSection && (
            <Row
              icon={<PiClockDuotone />}
              iconTone="warning"
              label={t('referral.partner.underReview')}
              description={
                <>
                  {t('referral.partner.underReviewDesc')}
                  {partnerStatus?.latest_application?.created_at && (
                    <span className="mt-1 block text-xs text-dark-500">
                      {t('referral.partner.submittedAt', {
                        date: new Date(
                          partnerStatus.latest_application.created_at,
                        ).toLocaleDateString(i18n.language),
                      })}
                    </span>
                  )}
                </>
              }
            />
          )}

          {/* Status: approved — Partner Badge */}
          {showApprovedSection && (
            <Row
              icon={<PiHandshakeDuotone />}
              iconTone="success"
              label={t('referral.partner.partnerStatus')}
              description={t('referral.partner.commissionInfo', {
                percent: partnerStatus?.commission_percent ?? 0,
              })}
              trailing={<Chip tone="success">{t('referral.partner.active')}</Chip>}
            />
          )}

          {/* Status: rejected — Rejection Notice */}
          {showRejectedSection && (
            <div className="flex items-start gap-3 px-4 py-3">
              <RowIcon tone="error">
                <PiWarningCircleDuotone />
              </RowIcon>
              {/* Ссылка в комментарии администратора распирала колонку — обрезался заголовок. */}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-dark-100">
                  {t('referral.partner.rejected')}
                </p>
                {partnerStatus?.latest_application?.admin_comment && (
                  <p className="mt-0.5 text-[13px] leading-snug text-dark-400 [overflow-wrap:anywhere]">
                    {partnerStatus.latest_application.admin_comment}
                  </p>
                )}
                <Button
                  tone="secondary"
                  onClick={() => navigate('/referral/partner/apply')}
                  className="mt-3 h-10 px-4 text-sm"
                >
                  {t('referral.partner.reapplyButton')}
                </Button>
              </div>
            </div>
          )}
        </Group>
      )}

      {/* ==================== Partner Campaigns Section ==================== */}
      {partnerVisible &&
        isPartner &&
        partnerStatus?.campaigns &&
        partnerStatus.campaigns.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>{t('referral.partner.yourCampaigns')}</SectionTitle>
            {partnerStatus.campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </section>
        )}

      {/* ==================== Withdrawal Section ==================== */}
      {withdrawalSectionVisible && (
        <div id="withdrawal-section" className="space-y-6">
          {withdrawalEnabled && withdrawalBalance && (
            <section>
              <SectionTitle>{t('referral.withdrawal.title')}</SectionTitle>
              <div className="overflow-hidden rounded-3xl bg-dark-900/70">
                <div className="p-4 sm:p-5">
                  <Stat
                    label={t('referral.withdrawal.available')}
                    value={formatPriceShort(withdrawalBalance.available_total)}
                    hint={
                      !withdrawalBalance.can_request && withdrawalBalance.cannot_request_reason
                        ? withdrawalBalance.cannot_request_reason
                        : withdrawalBalance.min_amount_kopeks > 0
                          ? t('referral.withdrawal.minAmount', {
                              amount: formatPriceShort(withdrawalBalance.min_amount_kopeks),
                            })
                          : undefined
                    }
                  />
                  <Button
                    onClick={() => navigate('/referral/withdrawal/request')}
                    disabled={!withdrawalBalance.can_request}
                    className="mt-4 w-full"
                  >
                    <PiWalletDuotone className="h-5 w-5" />
                    {t('referral.withdrawal.requestButton')}
                  </Button>
                </div>
                {/* Разбивка — только ненулевые строки: четыре «0,00 ₽» подряд
                    ничего не сообщают. */}
                {withdrawalBreakdown.length > 0 && (
                  <div className="divide-y divide-dark-800/70 border-t border-dark-800/70">
                    {withdrawalBreakdown.map((line) => (
                      <Row
                        key={line.key}
                        icon={line.icon}
                        iconTone="muted"
                        label={line.label}
                        hint={formatPriceShort(line.kopeks)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Withdrawal History */}
          {withdrawalHistory?.items && withdrawalHistory.items.length > 0 ? (
            <Group title={t('referral.withdrawal.history')}>
              {withdrawalHistory.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <RowIcon tone={withdrawalStatusTone(item.status)}>
                    <PiWalletDuotone />
                  </RowIcon>
                  <div className="min-w-0 flex-1">
                    {/* Сумма и статус не рвутся внутри себя: не влезли рядом —
                        статус уходит строкой ниже, а не «₽» и полбейджа. */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="whitespace-nowrap text-[15px] font-semibold text-dark-100">
                        {money(item.amount_rubles)}
                      </span>
                      <Chip tone={withdrawalStatusTone(item.status)}>
                        {t(`referral.withdrawal.status.${item.status}`, item.status)}
                      </Chip>
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-dark-400">
                      {new Date(item.created_at).toLocaleDateString(i18n.language)}
                      {item.payment_details && (
                        <span className="ml-1">
                          &bull;{' '}
                          {item.payment_details.length > 40
                            ? `${item.payment_details.slice(0, 40)}...`
                            : item.payment_details}
                        </span>
                      )}
                    </div>
                    {item.admin_comment && (
                      <div className="mt-1 text-xs text-dark-400 [overflow-wrap:anywhere]">
                        {item.admin_comment}
                      </div>
                    )}
                  </div>
                  {item.status === 'pending' && (
                    <Button
                      tone="danger"
                      onClick={() => cancelWithdrawalMutation.mutate(item.id)}
                      disabled={cancelWithdrawalMutation.isPending}
                      className="h-9 shrink-0 rounded-xl px-3 text-sm"
                    >
                      {t('common.cancel')}
                    </Button>
                  )}
                </div>
              ))}
            </Group>
          ) : (
            <section>
              <SectionTitle>{t('referral.withdrawal.history')}</SectionTitle>
              <Surface className="py-6 text-center text-[13px] text-dark-400">
                {t('referral.withdrawal.noHistory')}
              </Surface>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
