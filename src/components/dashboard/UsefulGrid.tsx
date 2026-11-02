import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  PiBookOpen,
  PiTelevision,
  PiLaptop,
  PiDatabase,
  PiGift,
  PiTicket,
  PiWallet,
  PiHeadset,
} from 'react-icons/pi';

/**
 * «Полезное» — восьмёрка спокойных тайлов с подписями, как в референсе.
 * Единый размер, ровная сетка 4×2, без градиентных заливок.
 * Списка новостей в кабинете нет (только статьи /news/:slug) — вместо
 * «Новостей» ведём «Поддержку»: ссылка в никуда хуже честной замены.
 */
interface UsefulGridProps {
  giftEnabled: boolean;
}

export default function UsefulGrid({ giftEnabled }: UsefulGridProps) {
  const { t } = useTranslation();

  const items = [
    {
      key: 'instructions',
      label: t('dashboard.useful.instructions', 'Инструкция'),
      to: '/info',
      icon: PiBookOpen,
    },
    {
      key: 'qrTv',
      label: t('dashboard.useful.qrTv', 'QR для ТВ'),
      to: '/connection/qr',
      icon: PiTelevision,
    },
    {
      key: 'devices',
      label: t('dashboard.useful.devices', 'Устройства'),
      to: '/connection',
      icon: PiLaptop,
    },
    {
      key: 'buyTraffic',
      label: t('dashboard.useful.buyTraffic', 'Докупить ГБ'),
      to: '/subscription?topup=traffic',
      icon: PiDatabase,
    },
    ...(giftEnabled
      ? [
          {
            key: 'gift',
            label: t('dashboard.useful.gift', 'Подарок'),
            to: '/gift',
            icon: PiGift,
          },
        ]
      : []),
    {
      key: 'promocode',
      label: t('dashboard.useful.promocode', 'Промокод'),
      to: '/balance',
      icon: PiTicket,
    },
    {
      key: 'balance',
      label: t('dashboard.useful.balance', 'Баланс'),
      to: '/balance',
      icon: PiWallet,
    },
    {
      key: 'support',
      label: t('dashboard.useful.support', 'Поддержка'),
      to: '/support',
      icon: PiHeadset,
    },
  ];

  return (
    <section aria-label={t('dashboard.useful.title', 'Полезное')}>
      <div className="mb-3 px-1">
        <h2 className="text-base font-bold tracking-tight text-dark-50">
          {t('dashboard.useful.title', 'Полезное')}
        </h2>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className="group flex flex-col items-center gap-2"
          >
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-dark-600/50 bg-dark-800/50 text-dark-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 group-hover:border-dark-500/60 group-hover:text-dark-100">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="text-2xs font-medium text-dark-400 transition-colors group-hover:text-dark-200">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-col items-center gap-1.5">
        <Link
          to="/offer"
          className="text-xs text-dark-500 transition-colors hover:text-dark-300"
        >
          {t('legal.serviceRules', 'Правила сервиса')}
        </Link>
        <Link
          to="/privacy"
          className="text-xs text-dark-500 transition-colors hover:text-dark-300"
        >
          {t('legal.privacy', 'Политика конфиденциальности')}
        </Link>
      </div>
    </section>
  );
}
