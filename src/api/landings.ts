import apiClient from './client';

export interface PurchaseStatus {
  status: 'pending' | 'paid' | 'delivered' | 'pending_activation' | 'failed' | 'expired';
  subscription_url: string | null;
  subscription_crypto_link: string | null;
  is_gift: boolean;
  contact_value: string | null;
  recipient_contact_value: string | null;
  period_days: number | null;
  tariff_name: string | null;
  gift_message: string | null;
  contact_type: 'email' | 'telegram' | null;
  cabinet_email: string | null;
  cabinet_password: string | null;
  auto_login_token: string | null;
  recipient_in_bot: boolean | null;
  bot_link: string | null;
  // Transferable gift claim link — the buyer forwards this; whoever activates it
  // gets the gift. Derived from token + status (purchase.user is null until claim).
  is_claimable: boolean;
  claim_url: string | null;
  bot_claim_link: string | null;
}

export interface GiftClaimResult {
  status: string;
  tariff_name: string | null;
  period_days: number | null;
  subscription_url: string | null;
  subscription_crypto_link: string | null;
  auto_login_token: string | null;
}

export const landingApi = {
  getPurchaseStatus: async (token: string): Promise<PurchaseStatus> => {
    const response = await apiClient.get(`/cabinet/landing/purchase/${token}`);
    return response.data;
  },

  activatePurchase: async (token: string): Promise<PurchaseStatus> => {
    const response = await apiClient.post(`/cabinet/landing/activate/${token}`);
    return response.data;
  },

  // Public gift claim page data (no auth — the token is the bearer secret).
  getGiftClaim: async (token: string): Promise<PurchaseStatus> => {
    const response = await apiClient.get(`/cabinet/landing/gift/${token}`);
    return response.data;
  },

  // Web (email) arm of the gift claim — binds the gift to the given email account.
  claimGift: async (token: string, email: string): Promise<GiftClaimResult> => {
    const response = await apiClient.post(`/cabinet/landing/gift/${token}/claim`, { email });
    return response.data;
  },
};
