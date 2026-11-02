import { useTranslation } from 'react-i18next';

interface DashboardHeroProps {
  variant: 'active' | 'none';
  planName?: string | null;
  daysLeft?: number;
}

/**
 * Фокус-визуал главной: стеклянный 3D-арт + гигантская цифра.
 * Чисто презентационный слой — никаких действий и данных не дублирует,
 * CTA живут в QuickActions и карточках ниже.
 */
export default function DashboardHero({ variant, planName, daysLeft }: DashboardHeroProps) {
  const { t } = useTranslation();

  if (variant === 'none') {
    return (
      <section className="hero-visual" aria-label={t('dashboard.hero.noneTitle') ?? undefined}>
        <div className="hero-ambient" aria-hidden />
        <img
          className="hero-orb hero-orb-cluster"
          src="/img/glass-cluster.jpg"
          alt=""
          aria-hidden
        />
        <div className="relative z-10 max-w-[250px] p-5">
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-dark-50">
            {t('dashboard.hero.noneTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-dark-300">
            {t('dashboard.hero.noneSubtitle')}
          </p>
        </div>
      </section>
    );
  }

  const lowDays = daysLeft != null && daysLeft <= 3;

  return (
    <section className="hero-visual" aria-label={planName ?? undefined}>
      <div className="hero-ambient" aria-hidden />
      <img className="hero-orb" src="/img/hero-orb.jpg" alt="" aria-hidden />
      {/* Компактная статус-полоса: без гигантской цифры — дни уже есть в
          карточке подписки ниже, третий раз дублировать нечего. */}
      <div className="relative z-10 flex min-h-[92px] items-center justify-between gap-3 p-4">
        <span className="hero-pill">VPN · {planName}</span>
        <span className="flex items-center gap-2 font-mono text-[12px] font-semibold tabular-nums tracking-[0.06em]">
          <span className={`led led-live`} aria-hidden />
          <span className={lowDays ? 'text-warning-400' : 'text-dark-200'}>
            {daysLeft} {t('subscription.daysShort')}
          </span>
        </span>
      </div>
    </section>
  );
}
