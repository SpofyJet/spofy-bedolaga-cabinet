import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  PiPlugsConnectedFill,
  PiArrowClockwiseFill,
  PiPlusCircleFill,
  PiGiftFill,
} from 'react-icons/pi';

import { cn } from '@/lib/utils';

/**
 * Быстрые действия главной: один тап — один ответ на «что сделать дальше».
 * Иерархия через вес и акцент, не через радугу подложек: единственный цветной
 * элемент — первое действие, остальные спокойные hairline-чипы.
 */
interface QuickActionsProps {
  /** Есть активный или ограниченный доступ — показываем «Подключить». */
  canConnect: boolean;
  /** Есть подписка (любая) — показываем «Продлить». */
  hasSubscription: boolean;
  /** Маршрут продления: конкретная подписка или список. */
  renewTo: string;
  onConnect?: () => void;
  connectTo?: string;
}

export default function QuickActions({
  canConnect,
  hasSubscription,
  renewTo,
  onConnect,
  connectTo = '/connection',
}: QuickActionsProps) {
  const { t } = useTranslation();

  const actions = [
    canConnect
      ? {
          key: 'connect',
          label: t('dashboard.quick.connect'),
          icon: PiPlugsConnectedFill,
          to: connectTo,
          onClick: onConnect,
          primary: true,
        }
      : null,
    hasSubscription
      ? {
          key: 'renew',
          label: t('dashboard.quick.renew'),
          icon: PiArrowClockwiseFill,
          to: renewTo,
          primary: false,
        }
      : null,
    {
      key: 'topup',
      label: t('dashboard.quick.topup'),
      icon: PiPlusCircleFill,
      to: '/balance/top-up',
      primary: false,
    },
    {
      key: 'invite',
      label: t('dashboard.quick.invite'),
      icon: PiGiftFill,
      to: '/referral',
      primary: false,
    },
  ].filter((a): a is NonNullable<typeof a> => a !== null);

  if (actions.length === 0) return null;

  return (
    // Ровная сетка: колонок ровно столько, сколько действий — тайлы всегда
    // одинаковой ширины и всегда по центру, на телефоне и на ПК.
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
    >
      {actions.map((action) => (
        <Link
          key={action.key}
          to={action.to}
          onClick={action.onClick}
          className="group flex flex-col items-center gap-2 transition-transform duration-200 active:scale-95"
        >
          <span
            className={cn(
              'flex h-[52px] w-full max-w-[64px] items-center justify-center rounded-2xl border transition-all duration-200',
              action.primary
                ? 'border-accent-400/50 bg-gradient-to-b from-accent-500/20 to-accent-500/5 text-accent-300 shadow-[0_0_26px_-8px_rgba(var(--color-accent-500),0.6),inset_0_1px_0_rgba(255,255,255,0.08)] group-hover:from-accent-500/25'
                : 'border-dark-600/50 bg-dark-800/50 text-dark-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] group-hover:border-dark-500/60 group-hover:text-dark-100',
            )}
          >
            <action.icon className="h-5 w-5" />
          </span>
          <span
            className={cn(
              'text-2xs font-semibold transition-colors',
              action.primary ? 'text-accent-300' : 'text-dark-400 group-hover:text-dark-200',
            )}
          >
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
