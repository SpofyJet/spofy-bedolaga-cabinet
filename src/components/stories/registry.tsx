import { useTranslation } from 'react-i18next';

import type { StoryCtaKey, StorySeries, StorySeriesMeta, StorySlideContent } from './types';

/**
 * Реестр серий сторис. Контент — в локалях, визуальные параметры — здесь.
 * Новая серия = запись в STORY_SERIES + блок в четырёх JSON-локалях.
 */
export const STORY_SERIES: readonly StorySeriesMeta[] = [
  {
    id: 'appstore-region',
    order: 1,
    coverImage: '/img/story-appstore.jpg',
    featured: true,
    palette: { from: '#0E9F6E', to: '#0B7285', accent: '#34D399' },
    art: ['globe-intro', 'account', 'country', 'payment-none', 'cta-check'],
    cta: 'purchase',
  },
  {
    id: 'connect-ios',
    order: 2,
    coverImage: '/img/story-ios.jpg',
    palette: { from: '#4F46E5', to: '#1D4ED8', accent: '#818CF8' },
    art: ['shield-intro', 'connect', 'install', 'cta-check'],
    cta: 'connect',
  },
  {
    id: 'connect-android',
    order: 3,
    coverImage: '/img/story-android.jpg',
    palette: { from: '#7C3AED', to: '#4C1D95', accent: '#A78BFA' },
    art: ['shield-intro', 'connect', 'install', 'cta-check'],
    cta: 'connect',
  },
  {
    id: 'no-connection',
    order: 4,
    coverImage: '/img/story-wrench.jpg',
    palette: { from: '#B45309', to: '#78350F', accent: '#FBBF24' },
    art: ['alert-intro', 'status', 'refresh', 'chat'],
    cta: 'support',
  },
];

export const STORY_CTA_ROUTES: Record<StoryCtaKey, string> = {
  connect: '/connection',
  purchase: '/subscription/purchase',
  renew: '/subscriptions',
  topup: '/balance/top-up',
  support: '/support',
};

export function getSeriesMeta(id: string): StorySeriesMeta | undefined {
  return STORY_SERIES.find((s) => s.id === id);
}

/**
 * Собирает серию: метаданные + локализованный контент текущей локали.
 * returnObjects даёт массив слайдов из JSON; сферический ключ в вакууме —
 * на случай битого бандла локали защищаемся пустым массивом.
 */
export function useStorySeries(): StorySeries[] {
  const { t } = useTranslation();

  return [...STORY_SERIES]
    .sort((a, b) => a.order - b.order)
    .map((meta) => {
      const coverTitle = t(`stories.series.${meta.id}.coverTitle`);
      const slides = t(`stories.series.${meta.id}.slides`, {
        returnObjects: true,
      }) as unknown as StorySlideContent[];
      return {
        meta,
        coverTitle,
        slides: Array.isArray(slides) ? slides.filter((s) => s && s.title) : [],
      };
    });
}
