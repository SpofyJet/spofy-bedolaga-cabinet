import { Link } from 'react-router';
import { BackIcon } from './icons';

interface WebBackButtonProps {
  to: string;
  replace?: boolean;
  className?: string;
}

/**
 * Кнопка «Назад» на странице. Видна и в Telegram: нативная кнопка есть не в
 * каждом клиенте (и не на каждом экране), а застревать на странице нельзя.
 */
export function WebBackButton({ to, replace, className }: WebBackButtonProps) {
  return (
    <Link
      to={to}
      replace={replace}
      className={
        className ||
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-dark-900/70 text-dark-200 ring-1 ring-inset ring-dark-800/80 transition-colors hover:bg-dark-800/70 hover:text-dark-50'
      }
    >
      <BackIcon />
    </Link>
  );
}
