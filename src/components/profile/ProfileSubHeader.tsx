import { PageHeader } from '@/components/layout/PageHeader';

/** Заголовок подстраницы профиля — общая шапка с «Назад» (видна и в Telegram). */
export function ProfileSubHeader({ title }: { title: string }) {
  return <PageHeader title={title} backTo="/profile" />;
}
