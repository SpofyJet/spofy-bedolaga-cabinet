import { describe, expect, it } from 'vitest';
import { spofyPaymentIcon } from './PaymentMethodIcon';

describe('spofyPaymentIcon', () => {
  it('WATA — это СБП, а не карта', () => {
    expect(spofyPaymentIcon('wata')).toBe('spofy_sbp');
  });

  it('Platega: СБП и карты остаются как были', () => {
    expect(spofyPaymentIcon('platega_m2')).toBe('spofy_sbp');
    expect(spofyPaymentIcon('platega_m11')).toBe('spofy_card');
    expect(spofyPaymentIcon('platega_m12')).toBe('spofy_intl_card');
  });
});
