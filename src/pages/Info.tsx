import { uiLocale } from '@/utils/uiLocale';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PiCaretDownBold } from 'react-icons/pi';
import { infoApi, type FaqPage, type InfoVisibility } from '../api/info';
import { formatContent } from '../utils/legalContent';
import { promoApi, type LoyaltyTierInfo } from '../api/promo';
import { DocumentIcon, QuestionIcon, ShieldIcon, StarIcon } from '@/components/icons';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, Page } from '@/components/spofy/ui';
import { Link } from 'react-router';

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <PiCaretDownBold
    className={`h-3.5 w-3.5 shrink-0 text-dark-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
  />
);

export default function Info() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('faq');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const locale = i18n.language.split('-')[0];

  const { data: visibility } = useQuery({
    queryKey: ['info-visibility'],
    queryFn: infoApi.getVisibility,
    staleTime: 60_000,
  });

  const { data: faqPages, isLoading: faqLoading } = useQuery({
    queryKey: ['faq-pages', locale],
    queryFn: () => infoApi.getFaqPages(locale),
    enabled: activeTab === 'faq',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['rules', locale],
    queryFn: () => infoApi.getRules(locale),
    enabled: activeTab === 'rules',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: privacy, isLoading: privacyLoading } = useQuery({
    queryKey: ['privacy-policy', locale],
    queryFn: () => infoApi.getPrivacyPolicy(locale),
    enabled: activeTab === 'privacy',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: offer, isLoading: offerLoading } = useQuery({
    queryKey: ['public-offer', locale],
    queryFn: () => infoApi.getPublicOffer(locale),
    enabled: activeTab === 'offer',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: loyaltyData, isLoading: loyaltyLoading } = useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: promoApi.getLoyaltyTiers,
    enabled: activeTab === 'loyalty',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const tabs = useMemo(() => {
    const builtinTabs: Array<{ id: string; label: string; icon: React.FC }> = [
      { id: 'faq', label: t('info.faq'), icon: QuestionIcon },
      { id: 'rules', label: t('info.rules'), icon: DocumentIcon },
      { id: 'privacy', label: t('info.privacy'), icon: ShieldIcon },
      { id: 'offer', label: t('info.offer'), icon: DocumentIcon },
      { id: 'loyalty', label: t('info.loyalty'), icon: StarIcon },
    ];

    return builtinTabs.filter((tab) => {
      // Spofy: программа лояльности («Статусы») в разделе «Информация» не показывается.
      if (tab.id === 'loyalty') return false;
      if (!visibility) return true;
      return visibility[tab.id as keyof InfoVisibility];
    });
  }, [visibility, t]);

  useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const toggleFaq = useCallback((id: number) => {
    setExpandedFaq((prev) => (prev === id ? null : id));
  }, []);

  const renderContent = () => {
    if (activeTab === 'faq') {
      if (faqLoading) {
        return (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16 rounded-3xl" />
          </SkeletonGroup>
        );
      }

      if (!faqPages || faqPages.length === 0) {
        return <InfoEmpty icon={<QuestionIcon />} title={t('info.noFaq')} />;
      }

      return (
        <div className="divide-y divide-dark-800/70 overflow-hidden rounded-3xl bg-dark-900/70">
          {faqPages.map((faq: FaqPage) => (
            <div key={faq.id} className="overflow-hidden">
              <button
                onClick={() => toggleFaq(faq.id)}
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-dark-800/40"
              >
                <span className="min-w-0 text-[15px] font-semibold text-dark-100">{faq.title}</span>
                <ChevronIcon expanded={expandedFaq === faq.id} />
              </button>
              {expandedFaq === faq.id && (
                <div className="prose prose-invert max-w-none px-4 pb-4 text-dark-300">
                  <div
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML проходит через DOMPurify
                    dangerouslySetInnerHTML={{ __html: formatContent(faq.content) }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'rules') {
      if (rulesLoading) {
        return (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16 rounded-3xl" />
          </SkeletonGroup>
        );
      }

      if (!rules?.content) {
        return <InfoEmpty icon={<DocumentIcon />} title={t('info.noContent')} />;
      }

      return (
        <div className="rounded-3xl bg-dark-900/70 p-4 sm:p-5 prose prose-invert max-w-none">
          <div
            className="overflow-x-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML проходит через DOMPurify
            dangerouslySetInnerHTML={{ __html: formatContent(rules.content) }}
          />
          {rules.updated_at && (
            <p className="mt-6 border-t border-dark-800/70 pt-4 text-[13px] text-dark-400">
              {t('info.updatedAt')}: {new Date(rules.updated_at).toLocaleDateString(uiLocale())}
            </p>
          )}
        </div>
      );
    }

    if (activeTab === 'privacy') {
      if (privacyLoading) {
        return (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16 rounded-3xl" />
          </SkeletonGroup>
        );
      }

      if (!privacy?.content) {
        return <InfoEmpty icon={<DocumentIcon />} title={t('info.noContent')} />;
      }

      return (
        <div className="rounded-3xl bg-dark-900/70 p-4 sm:p-5 prose prose-invert max-w-none">
          <div
            className="overflow-x-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML проходит через DOMPurify
            dangerouslySetInnerHTML={{ __html: formatContent(privacy.content) }}
          />
          {privacy.updated_at && (
            <p className="mt-6 border-t border-dark-800/70 pt-4 text-[13px] text-dark-400">
              {t('info.updatedAt')}: {new Date(privacy.updated_at).toLocaleDateString(uiLocale())}
            </p>
          )}
        </div>
      );
    }

    if (activeTab === 'offer') {
      if (offerLoading) {
        return (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16 rounded-3xl" />
          </SkeletonGroup>
        );
      }

      if (!offer?.content) {
        return <InfoEmpty icon={<DocumentIcon />} title={t('info.noContent')} />;
      }

      return (
        <div className="rounded-3xl bg-dark-900/70 p-4 sm:p-5 prose prose-invert max-w-none">
          <div
            className="overflow-x-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML проходит через DOMPurify
            dangerouslySetInnerHTML={{ __html: formatContent(offer.content) }}
          />
          {offer.updated_at && (
            <p className="mt-6 border-t border-dark-800/70 pt-4 text-[13px] text-dark-400">
              {t('info.updatedAt')}: {new Date(offer.updated_at).toLocaleDateString(uiLocale())}
            </p>
          )}
        </div>
      );
    }

    if (activeTab === 'loyalty') {
      if (loyaltyLoading) {
        return (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16 rounded-3xl" />
          </SkeletonGroup>
        );
      }

      if (!loyaltyData || loyaltyData.tiers.length === 0) {
        return (
          <div className="rounded-3xl bg-dark-900/70 px-6 py-10 text-center text-[13px] text-dark-400">
            {t('info.noLoyaltyTiers')}
          </div>
        );
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(uiLocale(), {
          style: 'currency',
          currency: 'RUB',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount);
      };

      const getStatusBadge = (tier: LoyaltyTierInfo) => {
        if (tier.is_current) {
          return (
            <span className="rounded-full bg-accent-500/20 px-2 py-1 text-xs font-medium text-accent-400">
              {t('info.statusCurrent')}
            </span>
          );
        }
        if (tier.is_achieved) {
          return (
            <span className="rounded-full bg-success-500/20 px-2 py-1 text-xs font-medium text-success-400">
              {t('info.statusAchieved')}
            </span>
          );
        }
        return (
          <span className="rounded-full bg-dark-800 px-2 py-1 text-xs font-medium text-dark-400">
            {t('info.statusLocked')}
          </span>
        );
      };

      const hasAnyDiscount = (tier: LoyaltyTierInfo) => {
        return (
          tier.server_discount_percent > 0 ||
          tier.traffic_discount_percent > 0 ||
          tier.device_discount_percent > 0 ||
          Object.keys(tier.period_discounts).length > 0
        );
      };

      return (
        <div className="space-y-6">
          {/* Progress Card */}
          <div className="rounded-3xl bg-dark-900/70 p-4 sm:p-5">
            <h3 className="mb-4 text-[15px] font-semibold text-dark-50">
              {t('info.yourProgress')}
            </h3>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-400">{t('info.totalSpent')}</div>
                <div className="truncate text-base font-bold text-dark-50 sm:text-lg">
                  {formatCurrency(loyaltyData.current_spent_rubles)}
                </div>
              </div>
              <div className="rounded-xl bg-dark-800/50 p-3">
                <div className="mb-1 text-xs text-dark-400">{t('info.currentStatus')}</div>
                <div className="truncate text-base font-bold text-accent-400 sm:text-lg">
                  {loyaltyData.current_tier_name || '-'}
                </div>
              </div>
            </div>

            {/* Progress bar to next tier */}
            {loyaltyData.next_tier_name && loyaltyData.next_tier_threshold_rubles ? (
              <div>
                <div className="mb-2 flex flex-col gap-1 text-xs text-dark-400 sm:flex-row sm:justify-between">
                  <span>
                    {t('info.nextStatus')}: {loyaltyData.next_tier_name}
                  </span>
                  <span>
                    {t('info.toNextStatus')}:{' '}
                    {formatCurrency(
                      Math.max(
                        0,
                        loyaltyData.next_tier_threshold_rubles - loyaltyData.current_spent_rubles,
                      ),
                    )}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-dark-800">
                  <div
                    className="h-full rounded-full bg-accent-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, loyaltyData.progress_percent)}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-dark-400">
                  {loyaltyData.progress_percent.toFixed(1)}%
                </div>
              </div>
            ) : (
              <div className="py-2 text-center font-medium text-success-400">
                {t('info.allStatusesAchieved')}
              </div>
            )}
          </div>

          {/* Tiers List */}
          <div className="space-y-3">
            {loyaltyData.tiers.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-3xl p-4 transition-colors ${
                  tier.is_current
                    ? 'bg-accent-500/15'
                    : tier.is_achieved
                      ? 'bg-dark-900/70'
                      : 'bg-dark-900/70 opacity-70'
                }`}
              >
                {/* Левая группа сжимается, плашка статуса — нет: раньше она уходила
                    за карточку, а название уровня обрезалось. */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        tier.is_current
                          ? 'bg-accent-500/20 text-accent-400'
                          : tier.is_achieved
                            ? 'bg-success-500/20 text-success-400'
                            : 'bg-dark-700 text-dark-400'
                      }`}
                    >
                      <StarIcon />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-dark-50 [overflow-wrap:anywhere]">
                        {tier.name}
                      </h4>
                      <p className="text-xs text-dark-400">
                        {t('info.threshold')}: {formatCurrency(tier.threshold_rubles)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0">{getStatusBadge(tier)}</span>
                </div>

                {/* Discounts */}
                {hasAnyDiscount(tier) ? (
                  <div className="rounded-xl bg-dark-800/50 p-3">
                    <div className="mb-2 text-xs text-dark-400">{t('info.discounts')}:</div>
                    <div className="flex flex-wrap gap-2">
                      {tier.server_discount_percent > 0 && (
                        <span className="rounded-lg bg-dark-700 px-2 py-1 text-xs text-dark-200">
                          {t('info.serverDiscount')}: -{tier.server_discount_percent}%
                        </span>
                      )}
                      {tier.traffic_discount_percent > 0 && (
                        <span className="rounded-lg bg-dark-700 px-2 py-1 text-xs text-dark-200">
                          {t('info.trafficDiscount')}: -{tier.traffic_discount_percent}%
                        </span>
                      )}
                      {tier.device_discount_percent > 0 && (
                        <span className="rounded-lg bg-dark-700 px-2 py-1 text-xs text-dark-200">
                          {t('info.deviceDiscount')}: -{tier.device_discount_percent}%
                        </span>
                      )}
                      {Object.entries(tier.period_discounts).map(([days, percent]) => (
                        <span
                          key={days}
                          className="rounded-lg bg-dark-700 px-2 py-1 text-xs text-dark-200"
                        >
                          {t('info.periodDiscount', { days })}: -{percent}%
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-dark-500">{t('info.noDiscounts')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Page>
      <PageHeader title={t('info.title')} backTo="/profile" />

      {/* Вкладки переносятся на вторую строку (11.11): в одну строку с прокруткой
          «Оферта» уходила за край телефона, а «Конфиденциальность» резалась. */}
      <div className="flex flex-wrap gap-2 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-[40px] shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors [&>svg]:h-4 [&>svg]:w-4 ${
              activeTab === tab.id
                ? 'bg-accent-500/15 text-accent-300'
                : 'bg-dark-900/70 text-dark-300 hover:bg-dark-800/70'
            }`}
          >
            <tab.icon />
            <span className="max-w-[240px] truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {renderContent()}
    </Page>
  );
}

/** Пустой раздел: не голая строка, а понятный экран с выходом в поддержку. */
function InfoEmpty({ icon, title }: { icon: React.ReactNode; title: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={icon}
      title={title}
      text={t('info.emptyHint')}
      action={
        <Link
          to="/support"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-dark-800/70 px-5 text-[15px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/70"
        >
          {t('info.writeSupport')}
        </Link>
      }
    />
  );
}
