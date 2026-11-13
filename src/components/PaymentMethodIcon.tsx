interface PaymentMethodIconProps {
  method: string;
  className?: string;
}

export default function PaymentMethodIcon({
  method,
  className = 'h-8 w-8',
}: PaymentMethodIconProps) {
  switch (method) {
    case 'telegram_stars':
      return (
        <svg className={className} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#229ED9" />
          <path
            d="M20 8l3.09 6.26L30 15.27l-5 4.87 1.18 6.88L20 23.77l-6.18 3.25L15 20.14l-5-4.87 6.91-1.01L20 8z"
            fill="#FFD700"
          />
        </svg>
      );

    case 'cryptobot':
      return (
        <svg className={className} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#0088CC" />
          <path
            d="M20 7c-7.18 0-13 5.82-13 13s5.82 13 13 13 13-5.82 13-13S27.18 7 20 7zm1.5 18.75v2.5h-3v-2.4c-2.1-.3-3.8-1.2-4.6-2.1l1.8-2.4c.9.8 2.1 1.5 3.3 1.5 1.1 0 1.8-.5 1.8-1.3 0-.9-.8-1.3-2.5-1.9-2.3-.8-4.2-1.9-4.2-4.4 0-2.1 1.5-3.7 4.2-4.1v-2.4h3v2.3c1.6.2 2.9.9 3.8 1.7l-1.7 2.3c-.7-.6-1.7-1.1-2.8-1.1-1 0-1.6.4-1.6 1.2 0 .8.8 1.2 2.6 1.9 2.5.9 4.1 2 4.1 4.4 0 2.2-1.6 3.9-4.2 4.2z"
            fill="#fff"
          />
        </svg>
      );

    case 'pay2328':
      return (
        <svg className={className} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#1A1A2E" />
          <path
            d="M20 8l2.47 5.01.55 1.12 1.23.18L30 15.27l-4 3.9-.89.87.21 1.22L26.18 27 20.9 24.22l-1.1-.58-1.1.58L13.62 27l.86-5.74.21-1.22-.89-.87-4-3.9 5.75-.96 1.23-.18.55-1.12L20 8z"
            fill="#00E68A"
          />
        </svg>
      );

    case 'spofy_sbp':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#2B63F5" />
          <text
            x="20"
            y="24.6"
            textAnchor="middle"
            fontFamily="Manrope, system-ui, sans-serif"
            fontSize="12.5"
            fontWeight="800"
            letterSpacing=".3"
            fill="#fff"
          >
            СБП
          </text>
        </svg>
      );

    case 'spofy_intl_card':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#1B2232" />
          <circle cx="16.5" cy="20" r="7.5" fill="#EB001B" />
          <circle cx="23.5" cy="20" r="7.5" fill="#F79E1B" />
          <path d="M20 13.37A7.5 7.5 0 0 1 20 26.63A7.5 7.5 0 0 1 20 13.37Z" fill="#FF5F00" />
        </svg>
      );

    case 'spofy_card':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#0A84C6" />
          <rect
            x="9"
            y="12.5"
            width="22"
            height="15"
            rx="2.6"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
          />
          <path d="M9 17.3h22" stroke="#fff" strokeWidth="2.6" />
          <rect x="12.4" y="21.2" width="5.2" height="3.4" rx=".9" fill="#fff" />
        </svg>
      );

    case 'spofy_crypto_cryptobot':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#2F8FEA" />
          <circle
            cx="20"
            cy="20"
            r="10.5"
            fill="none"
            stroke="#fff"
            strokeOpacity=".35"
            strokeWidth="1.6"
          />
          <path d="M14.6 14.4h10.8v2.7h-4.05v10.4h-2.7V17.1H14.6z" fill="#fff" />
          <ellipse
            cx="20"
            cy="19.7"
            rx="6.4"
            ry="1.75"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
          />
        </svg>
      );

    case 'spofy_crypto_pay2328':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#12A37E" />
          <circle
            cx="20"
            cy="20"
            r="10.5"
            fill="none"
            stroke="#fff"
            strokeOpacity=".35"
            strokeWidth="1.6"
          />
          <path d="M14.6 14.4h10.8v2.7h-4.05v10.4h-2.7V17.1H14.6z" fill="#fff" />
          <ellipse
            cx="20"
            cy="19.7"
            rx="6.4"
            ry="1.75"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
          />
        </svg>
      );

    case 'spofy_crypto_xrocket':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#2A2F3A" />
          <circle
            cx="20"
            cy="20"
            r="10.5"
            fill="none"
            stroke="#fff"
            strokeOpacity=".35"
            strokeWidth="1.6"
          />
          <path d="M14.6 14.4h10.8v2.7h-4.05v10.4h-2.7V17.1H14.6z" fill="#fff" />
          <ellipse
            cx="20"
            cy="19.7"
            rx="6.4"
            ry="1.75"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
          />
        </svg>
      );

    case 'spofy_crypto':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#26A17B" />
          <circle
            cx="20"
            cy="20"
            r="10.5"
            fill="none"
            stroke="#fff"
            strokeOpacity=".35"
            strokeWidth="1.6"
          />
          <path d="M14.6 14.4h10.8v2.7h-4.05v10.4h-2.7V17.1H14.6z" fill="#fff" />
          <ellipse
            cx="20"
            cy="19.7"
            rx="6.4"
            ry="1.75"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
          />
        </svg>
      );

    case 'spofy_stars':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
          <rect width="40" height="40" rx="11" fill="#F2A60D" />
          <path
            d="M20 9.5l3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1z"
            fill="#fff"
          />
        </svg>
      );

    case 'platega':
      return (
        <svg className={className} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#6C5CE7" />
          <path
            d="M14 12h8c3.31 0 6 2.69 6 6s-2.69 6-6 6h-4v4h-4V12zm4 8h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4v4z"
            fill="#fff"
          />
        </svg>
      );

    case 'wata':
      return (
        <svg className={className} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#2D7FF9" />
          <path
            d="M20 10c-.55 0-1 .35-1.27.8L12 24c-.4.7.1 1.5.9 1.5h14.2c.8 0 1.3-.8.9-1.5l-6.73-13.2c-.27-.45-.72-.8-1.27-.8z"
            fill="#fff"
            opacity=".9"
          />
          <path
            d="M20 30c3.87 0 7-2.24 7-5 0-2.76-7-10-7-10s-7 7.24-7 10c0 2.76 3.13 5 7 5z"
            fill="#fff"
          />
        </svg>
      );

    default:
      return (
        <svg className={className} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#4B5563" />
          <path
            d="M10 14h20c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H10c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2zm0 3v6h20v-6H10z"
            fill="#fff"
            opacity=".7"
          />
        </svg>
      );
  }
}

const SPOFY_CRYPTO_ICONS: Record<string, string> = {
  cryptobot: 'spofy_crypto_cryptobot',
  pay2328: 'spofy_crypto_pay2328',
  xrocket: 'spofy_crypto_xrocket',
};
/** WATA принимает оплату по СБП, а не картой — знак «СБП». */
const SPOFY_SBP_METHODS = new Set(['wata']);

/**
 * Spofy: какую плитку показать способу оплаты — по тому, ЧЕМ платит человек
 * (СБП, карта, зарубежная карта, крипта, звёзды), а не по логотипу провайдера:
 * абстрактные знаки провайдеров покупателю ничего не говорили.
 */
export function spofyPaymentIcon(methodId: string): string {
  const id = methodId.toLowerCase();
  if (id === 'platega_m12') return 'spofy_intl_card';
  if (id === 'platega_m2' || id.includes('sbp') || SPOFY_SBP_METHODS.has(id)) return 'spofy_sbp';
  if (id.startsWith('platega')) return 'spofy_card';
  if (SPOFY_CRYPTO_ICONS[id]) return SPOFY_CRYPTO_ICONS[id];
  if (id.includes('crypto') || id.includes('ton') || id.includes('usdt')) return 'spofy_crypto';
  if (id.includes('stars')) return 'spofy_stars';
  return id;
}
