import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { PiTelevisionSimpleDuotone, PiTicketDuotone, PiReceiptDuotone } from 'react-icons/pi';

/**
 * «Полезное» — то, чего нет в карточках выше. Баланс, устройства и докупка
 * трафика уже живут в «Подписке/Балансе» и «Устройствах и трафике»,
 * поддержка — в нижней панели: повторять их здесь — шум.
 * «Инструкция» убрана (11.11): её дублирует история «Как подключить» наверху.
 * Правила и политика — в профиле: «О сервисе» ведёт на вкладки правил, политики и оферты.
 */
interface UsefulGridProps {
  /** Промокод уже стоит в быстрых действиях (экран без подписки) — второй раз не показываем. */
  hidePromocode?: boolean;
}

export default function UsefulGrid({ hidePromocode = false }: UsefulGridProps) {
  const { t } = useTranslation();

  const allItems = [
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
  const items = hidePromocode ? allItems.filter((i) => i.key !== 'promocode') : allItems;

  return (
    <section aria-label={t('dashboard.useful.title', 'Полезное')}>
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark-400">
        {t('dashboard.useful.title', 'Полезное')}
      </h2>
      {/* Плитки делят ширину поровну и стоят на той же подложке, что карточки выше:
          в сетке на 4 три плитки по 88px висели слева с дырой справа. */}
      <div className={cn('grid gap-2.5', items.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className="group flex h-14 items-center justify-center gap-2 rounded-2xl bg-dark-900/70 px-2 transition-colors duration-200 hover:bg-dark-800/50 active:bg-dark-800/70"
          >
            <item.icon className="h-5 w-5 shrink-0 text-accent-400 light:text-accent-500" />
            <span className="tile-label truncate text-[13px] font-semibold leading-none text-dark-200 group-hover:text-dark-50">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
