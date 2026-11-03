import { WebBackButton } from '@/components/WebBackButton';

/**
 * Заголовок подстраницы профиля. «Назад» — только в браузере: в Telegram
 * есть нативная кнопка, вторая рядом с ней путает.
 */
export function ProfileSubHeader({ title }: { title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <WebBackButton to="/profile" />
      <h1 className="text-xl font-bold tracking-tight text-dark-50 sm:text-2xl">{title}</h1>
    </div>
  );
}
