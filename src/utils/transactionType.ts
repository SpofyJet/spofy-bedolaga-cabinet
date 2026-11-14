/**
 * Подпись типа операции в истории баланса.
 *
 * Незнакомый тип из будущей версии бота — нейтральное «Операция».
 */
const TYPES: Record<string, string> = {
  DEPOSIT: 'balance.deposit',
  WITHDRAWAL: 'balance.withdrawal',
  SUBSCRIPTION_PAYMENT: 'balance.subscriptionPayment',
  REFUND: 'balance.refund',
  FAILED_REFUND: 'balance.failedRefund',
  REFERRAL_REWARD: 'balance.referralReward',
  POLL_REWARD: 'balance.pollReward',
  GIFT_PAYMENT: 'balance.giftPayment',
};

const lookup = (type: string) => TYPES[type?.toUpperCase?.() ?? ''];

export function transactionTypeLabelKey(type: string): string {
  return lookup(type) ?? 'balance.otherOperation';
}
