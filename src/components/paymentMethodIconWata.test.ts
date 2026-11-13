import { describe, expect, it } from 'vitest';
import { spofyPaymentIcon } from './PaymentMethodIcon';

describe('spofyPaymentIcon', () => {
  it('WATA — это СБП, а не карта', () => {
    expect(spofyPaymentIcon('wata')).toBe('spofy_sbp');
  });

  it('Platega: «Карта / СБП» со знаком СБП, зарубежные карты и карта РФ — своими', () => {
    expect(spofyPaymentIcon('platega_m2')).toBe('spofy_sbp');
    expect(spofyPaymentIcon('platega_m11')).toBe('spofy_card');
    expect(spofyPaymentIcon('platega_m12')).toBe('spofy_intl_card');
    // Способ без разворота по методам и строка статистики «platega».
    expect(spofyPaymentIcon('platega')).toBe('spofy_sbp');
  });

  it('крипта: у xRocket свой знак, у остальных — монета', () => {
    expect(spofyPaymentIcon('xrocket')).toBe('spofy_crypto_xrocket');
    expect(spofyPaymentIcon('pay2328')).toBe('spofy_crypto');
    expect(spofyPaymentIcon('cryptobot')).toBe('spofy_crypto');
    expect(spofyPaymentIcon('heleket')).toBe('spofy_crypto');
    expect(spofyPaymentIcon('platega_m13')).toBe('spofy_crypto');
  });

  it('звёзды Telegram и всё остальное', () => {
    expect(spofyPaymentIcon('telegram_stars')).toBe('spofy_stars');
    expect(spofyPaymentIcon('manual')).toBe('spofy_other');
    expect(spofyPaymentIcon('something_new')).toBe('spofy_other');
  });

  it('уже выбранный знак не меняется при повторном вызове', () => {
    for (const id of [
      'wata',
      'platega_m12',
      'platega_m11',
      'xrocket',
      'pay2328',
      'telegram_stars',
      'manual',
    ]) {
      const kind = spofyPaymentIcon(id);
      expect(spofyPaymentIcon(kind)).toBe(kind);
    }
  });

  it('у двух разных по смыслу способов знак не совпадает', () => {
    const kinds = ['platega_m2', 'platega_m12', 'pay2328', 'xrocket', 'telegram_stars'].map(
      spofyPaymentIcon,
    );
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
