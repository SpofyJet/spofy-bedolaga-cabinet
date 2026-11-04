import { useState, useEffect, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { withdrawalApi } from '../api/withdrawals';
import { useCurrency } from '../hooks/useCurrency';
import { formatPriceShort } from '../utils/format';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Page, Stat, Surface } from '@/components/spofy/ui';

export default function ReferralWithdrawalRequest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currencySymbol } = useCurrency();

  const [form, setForm] = useState({
    amount_rubles: 0,
    payment_details: '',
  });

  const { data: balance } = useQuery({
    queryKey: ['withdrawal-balance'],
    queryFn: withdrawalApi.getBalance,
  });

  // Guard: redirect if can't request
  useEffect(() => {
    if (balance && !balance.can_request) {
      navigate('/referral', { replace: true });
    }
  }, [balance, navigate]);

  const withdrawMutation = useMutation({
    mutationFn: withdrawalApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-balance'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawal-history'] });
      navigate('/referral');
    },
  });

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (form.payment_details.length < 5) return;
    if (form.amount_rubles <= 0) return;
    withdrawMutation.mutate({
      amount_kopeks: Math.round(form.amount_rubles * 100),
      payment_details: form.payment_details,
    });
  };

  return (
    <Page>
      <PageHeader title={t('referral.withdrawal.requestTitle')} backTo="/referral" />
      <Surface>
        <Stat
          label={t('referral.withdrawal.available')}
          value={balance ? formatPriceShort(balance.available_total) : '—'}
          hint={t('referral.withdrawal.fields.amountHint', {
            min: balance ? Math.ceil(balance.min_amount_kopeks / 100) : 0,
            currency: currencySymbol,
          })}
        />
      </Surface>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Surface className="space-y-4">
          <div>
            <label
              htmlFor="rw-amount"
              className="mb-1.5 block px-1 text-[13px] font-semibold text-dark-400"
            >
              {t('referral.withdrawal.fields.amount')}
            </label>
            <input
              id="rw-amount"
              type="number"
              min={balance ? Math.ceil(balance.min_amount_kopeks / 100) : 0}
              max={balance ? Math.floor(balance.available_total / 100) : 0}
              className="input w-full"
              value={form.amount_rubles || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount_rubles: e.target.value ? Number(e.target.value) : 0,
                })
              }
              placeholder={t('referral.withdrawal.fields.amountPlaceholder', {
                currency: currencySymbol,
              })}
            />
          </div>
          <div>
            <label
              htmlFor="rw-payment-details"
              className="mb-1.5 block px-1 text-[13px] font-semibold text-dark-400"
            >
              {balance?.requisites_text || t('referral.withdrawal.fields.paymentDetails')}
            </label>
            <textarea
              id="rw-payment-details"
              className="input min-h-[80px] w-full"
              value={form.payment_details}
              onChange={(e) => setForm({ ...form, payment_details: e.target.value })}
              placeholder={t('referral.withdrawal.fields.paymentDetailsPlaceholder')}
              required
              minLength={5}
            />
          </div>
        </Surface>

        {withdrawMutation.isError && (
          <div className="rounded-2xl bg-error-500/10 p-3 text-sm text-error-400 ring-1 ring-inset ring-error-500/25">
            {t('referral.withdrawal.requestError')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button tone="secondary" onClick={() => navigate('/referral')}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={
              withdrawMutation.isPending ||
              form.payment_details.length < 5 ||
              form.amount_rubles <= 0
            }
          >
            {withdrawMutation.isPending
              ? t('referral.withdrawal.requesting')
              : t('referral.withdrawal.submitRequest')}
          </Button>
        </div>
      </form>
    </Page>
  );
}
