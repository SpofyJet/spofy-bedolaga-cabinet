import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PiCaretRightBold, PiWalletDuotone } from 'react-icons/pi';

import { balanceApi } from '../api/balance';
import { useCurrency } from '../hooks/useCurrency';
import type { PaymentMethod } from '../types';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, Group, Page } from '@/components/spofy/ui';
import PaymentMethodIcon, { spofyPaymentIcon } from '@/components/PaymentMethodIcon';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Способы пополнения группами: человек сначала видит «чем платить»
 * (карта, крипта, звёзды), а уже потом провайдера. Каждый способ — своя
 * строка (одной кнопкой «Криптовалюта» не сворачиваем). Карты — первыми:
 * ими платит большинство.
 */
type MethodGroup = 'card' | 'crypto' | 'telegram' | 'other';
const METHOD_GROUP_ORDER: MethodGroup[] = ['card', 'crypto', 'telegram', 'other'];
const CRYPTO_METHODS = new Set(['cryptobot', 'pay2328', 'xrocket']);
const TELEGRAM_METHODS = new Set(['telegram_stars']);
const CARD_METHODS = new Set(['wata']);

function methodGroup(id: string): MethodGroup {
  if (CRYPTO_METHODS.has(id)) return 'crypto';
  if (TELEGRAM_METHODS.has(id)) return 'telegram';
  if (id.startsWith('platega') || CARD_METHODS.has(id)) return 'card';
  return 'other';
}

/** Способ, которым платят 9 из 10: помечаем «Быстро» (карта / СБП через Platega). */
const FAST_METHOD_ID = 'platega_m2';

const LEADING_EMOJI = /^(?:\p{Extended_Pictographic}|️|‍|\s)+/u;

/** Имя без эмодзи-префикса (рядом есть иконка); в группе крипты — без «Криптовалюта (…)». */
function methodTitle(name: string, group: MethodGroup): string {
  let title = name.replace(LEADING_EMOJI, '').trim();
  if (group === 'crypto') {
    const inner = title.match(/^крипто\S*\s*\((.+)\)$/i);
    if (inner) title = inner[1];
  }
  return title;
}

export default function TopUpMethodSelect() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { formatAmount, currencySymbol } = useCurrency();

  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });

  const handleMethodClick = (methodId: string) => {
    const params = new URLSearchParams();
    const amount = searchParams.get('amount');
    const returnTo = searchParams.get('returnTo');
    if (amount) params.set('amount', amount);
    if (returnTo) params.set('returnTo', returnTo);
    const qs = params.toString();
    navigate(`/balance/top-up/${methodId}${qs ? `?${qs}` : ''}`);
  };

  const renderMethod = (method: PaymentMethod, group: MethodGroup) => {
    const methodKey = method.id.toLowerCase().replace(/-/g, '_');
    const translatedName = t(`balance.paymentMethods.${methodKey}.name`, { defaultValue: '' });
    const translatedDesc = t(`balance.paymentMethods.${methodKey}.description`, {
      defaultValue: '',
    });
    const description = method.description || translatedDesc;
    const range = `${formatAmount(method.min_amount_kopeks / 100, 0)} – ${formatAmount(
      method.max_amount_kopeks / 100,
      0,
    )} ${currencySymbol}`;

    return (
      <button
        type="button"
        key={method.id}
        disabled={!method.is_available}
        onClick={() => method.is_available && handleMethodClick(method.id)}
        className={cn(
          'flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left',
          method.is_available
            ? 'transition-colors hover:bg-dark-800/40 active:bg-dark-800/60'
            : 'cursor-not-allowed opacity-50',
        )}
      >
        <PaymentMethodIcon method={spofyPaymentIcon(method.id)} className="h-10 w-10 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-dark-100">
              {methodTitle(method.name || translatedName, group)}
            </span>
            {method.id === FAST_METHOD_ID && (
              <span className="shrink-0 rounded-md bg-success-500/15 px-1.5 py-0.5 text-2xs font-semibold text-success-400">
                {t('balance.methodFast')}
              </span>
            )}
          </span>
          {/* Описание и суммы — всегда на своих строках. Через точку в одну строку на
              телефоне помещались два способа из шести, и строки списка выходили разной
              высоты. */}
          <span className="mt-0.5 block text-[13px] leading-snug text-dark-400">
            {method.is_available ? (
              <>
                {description && <span className="block">{description}</span>}
                <span className="block whitespace-nowrap">{range}</span>
              </>
            ) : (
              t('balance.notAvailable')
            )}
          </span>
        </span>
        {method.is_available && (
          <PiCaretRightBold className="h-3.5 w-3.5 shrink-0 text-dark-500" aria-hidden />
        )}
      </button>
    );
  };

  return (
    <Page>
      <PageHeader
        title={t('balance.topUpBalance')}
        subtitle={t('balance.topUpHintShort', 'Зачисление обычно за минуту')}
        backTo="/balance"
      />

      {isLoading ? (
        <Group>
          <SkeletonGroup className="space-y-2 p-4">
            <Skeleton variant="card" count={3} className="h-12" />
          </SkeletonGroup>
        </Group>
      ) : !paymentMethods || paymentMethods.length === 0 ? (
        <EmptyState icon={<PiWalletDuotone />} title={t('balance.noPaymentMethods')} />
      ) : (
        METHOD_GROUP_ORDER.map((group) => {
          const methods = paymentMethods.filter((m) => methodGroup(m.id) === group);
          if (methods.length === 0) return null;
          return (
            <Group key={group} title={t(`balance.methodGroups.${group}`)}>
              {methods.map((m) => renderMethod(m, group))}
            </Group>
          );
        })
      )}
    </Page>
  );
}
