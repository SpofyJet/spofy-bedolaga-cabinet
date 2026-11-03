import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  PiBookOpenTextDuotone,
  PiTelevisionSimpleDuotone,
  PiTicketDuotone,
  PiReceiptDuotone,
} from 'react-icons/pi';

/**
 * «Полезное» — то, чего нет в карточках выше. Баланс, устройства и докупка
 * трафика уже живут в «Подписке/Балансе» и «Устройствах и трафике»,
 * поддержка — в нижней панели: повторять их здесь — шум.
 */
export default function UsefulGrid() {
  const { t } = useTranslation();

  const items = [
    {
      key: 'instructions',
      label: t('dashboard.useful.instructions', 'Инструкция'),
      to: '/info',
      icon: PiBookOpenTextDuotone,
    },
    {
      key: 'qrTv',
      label: t('dashboard.useful.qrTv', 'QR для ТВ'),
      to: '/connection/qr',
      icon: PiTelevisionSimpleDuotone,
    },
    {
      key: 'promocode',
      label: t('dashboard.useful.promocode', 'Промокод'),
      to: '/balance?section=promo',
      icon: PiTicketDuotone,
    },
    {
      key: 'history',
      label: t('dashboard.useful.history', 'История'),
      to: '/balance?section=history',
      icon: PiReceiptDuotone,
    },
  ];

  return (
    <section aria-label={t('dashboard.useful.title', 'Полезное')}>
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
        {t('dashboard.useful.title', 'Полезное')}
      </h2>
      <div className="grid grid-cols-4 gap-2.5">
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className="group flex flex-col items-center gap-1.5 transition-transform duration-150 active:scale-95"
          >
            <span className="flex h-12 w-full max-w-[88px] items-center justify-center rounded-2xl bg-dark-800/70 text-accent-300 ring-1 ring-inset ring-dark-700/60 transition-colors duration-200 group-hover:bg-dark-700/70 sm:h-[52px]">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11.5px] font-semibold leading-none text-dark-300 group-hover:text-dark-100">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-dark-500">
        <Link to="/offer" className="transition-colors hover:text-dark-300">
          {t('legal.serviceRules', 'Правила сервиса')}
        </Link>
        <span aria-hidden className="h-3 w-px bg-dark-700" />
        <Link to="/privacy" className="transition-colors hover:text-dark-300">
          {t('legal.privacy', 'Политика конфиденциальности')}
        </Link>
      </div>
    </section>
  );
}
