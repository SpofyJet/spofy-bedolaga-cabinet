import { uiLocale } from '@/utils/uiLocale';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { infoApi } from '../api/info';
import { formatContent } from '../utils/legalContent';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

export type PublicLegalDoc = 'offer' | 'privacy' | 'recurrent';

interface PublicLegalProps {
  doc: PublicLegalDoc;
}

const DOC_CONFIG: Record<
  PublicLegalDoc,
  {
    queryKey: string;
    titleKey: string;
    titleFallback: string;
    fetch: (language?: string) => Promise<{ content: string; updated_at: string | null }>;
  }
> = {
  offer: {
    queryKey: 'public-offer',
    titleKey: 'footer.offer',
    titleFallback: 'Публичная оферта',
    fetch: infoApi.getPublicOffer,
  },
  privacy: {
    queryKey: 'privacy-policy',
    titleKey: 'footer.privacy',
    titleFallback: 'Политика конфиденциальности',
    fetch: infoApi.getPrivacyPolicy,
  },
  recurrent: {
    queryKey: 'recurrent-payments',
    titleKey: 'footer.recurrent',
    titleFallback: 'Рекуррентные платежи',
    fetch: infoApi.getRecurrentPayments,
  },
};

// Public, unauthenticated viewer for the legal documents linked from the login
// footer. Reads the same public /cabinet/info endpoints the authenticated Info page
// uses, so the pages are reachable before login instead of bouncing to /login.
export default function PublicLegal({ doc }: PublicLegalProps) {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language ?? '').split('-')[0];
  const config = DOC_CONFIG[doc];

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-legal', config.queryKey, locale],
    queryFn: () => config.fetch(locale),
    staleTime: 5 * 60 * 1000,
  });

  const title = t(config.titleKey, config.titleFallback);

  return (
    <div className="min-h-viewport bg-dark-950 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[600px]">
        <PageHeader title={title} backTo="/login" right={<LanguageSwitcher />} />

        {isLoading ? (
          <SkeletonGroup className="space-y-3">
            <Skeleton variant="card" count={3} className="h-16 rounded-3xl" />
          </SkeletonGroup>
        ) : isError || !data?.content ? (
          <div className="rounded-3xl bg-dark-900/70 p-5 text-dark-400 ring-1 ring-inset ring-dark-800/80">
            {t('info.documentUnavailable', 'Документ пока недоступен.')}
          </div>
        ) : (
          <div className="prose prose-invert max-w-none rounded-3xl bg-dark-900/70 p-5 ring-1 ring-inset ring-dark-800/80">
            <div dangerouslySetInnerHTML={{ __html: formatContent(data.content) }} />
            {data.updated_at && (
              <p className="mt-4 text-xs text-dark-500">
                {t('info.updatedAt', 'Обновлено')}:{' '}
                {new Date(data.updated_at).toLocaleDateString(uiLocale())}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
