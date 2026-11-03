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
      <h2 className="mb-3 px-1 text-base font-bold tracking-tight text-dark-50">
        {t('dashboard.useful.title', 'Полезное')}
      </h2>
      <div className="grid grid-cols-4 gap-2.5">
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className="group flex flex-col items-center gap-2 transition-transform duration-150 active:scale-95"
          >
            <span className="flex aspect-square w-full max-w-[64px] items-center justify-center rounded-2xl bg-accent-500/10 text-accent-300 ring-1 ring-inset ring-accent-500/15 transition-colors duration-200 group-hover:bg-accent-500/15">
              <item.icon className="h-7 w-7" />
            </span>
            <span className="text-center text-xs font-medium leading-tight text-dark-300 group-hover:text-dark-100">
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
