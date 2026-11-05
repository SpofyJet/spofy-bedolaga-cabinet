import { useTranslation } from 'react-i18next';
import {
  PiPlugsConnectedDuotone,
  PiAppStoreLogoDuotone,
  PiWrenchDuotone,
  PiDevicesDuotone,
} from 'react-icons/pi';

import type { StoryCtaKey, StorySeries, StorySeriesMeta, StorySlideContent } from './types';

/**
 * Реестр серий. Текст — в локалях, визуал — здесь: реальные скриншоты там, где
 * важно узнать экран (смена региона App Store), и фрагменты интерфейса там, где
 * нужно показать, куда нажать. Никаких сгенерированных картинок.
 */
export const STORY_SERIES: readonly StorySeriesMeta[] = [
  {
    id: 'connect',
    order: 1,
    accent: '#60A5FA',
    icon: PiPlugsConnectedDuotone,
    slides: [{ visual: 'install' }, { visual: 'add-sub' }, { visual: 'power' }],
    cta: 'connect',
  },
  {
    id: 'appstore-region',
    order: 2,
    accent: '#60A5FA',
    icon: PiAppStoreLogoDuotone,
    slides: [
      { image: '/img/story-region-1.jpg' },
      { image: '/img/story-region-2.jpg' },
      { image: '/img/story-region-3.jpg' },
      { image: '/img/story-region-4.jpg' },
      { image: '/img/story-region-5.jpg' },
    ],
    cta: 'connect',
  },
  {
    id: 'no-connection',
    order: 3,
    accent: '#60A5FA',
    icon: PiWrenchDuotone,
    slides: [
      { visual: 'refresh' },
      { visual: 'reset-path' },
      { visual: 'servers' },
      { visual: 'bypass' },
      { visual: 'support' },
    ],
    cta: 'support',
  },
  {
    id: 'add-device',
    order: 4,
    accent: '#60A5FA',
    icon: PiDevicesDuotone,
    slides: [{ visual: 'slots' }, { visual: 'web' }, { visual: 'tv-qr' }, { visual: 'limit' }],
    cta: 'devices',
  },
];

export const STORY_CTA_ROUTES: Record<StoryCtaKey, string> = {
  connect: '/connection',
  support: '/support',
  devices: '/subscription',
};

export function getSeriesMeta(id: string): StorySeriesMeta | undefined {
  return STORY_SERIES.find((s) => s.id === id);
}

/** Адрес кабинета для текста сторис — тот, с которого его открыли. */
export function cabinetHost(): string {
  return typeof window === 'undefined' ? '' : window.location.host;
}

/** Все фото из серий: просмотрщик загружает их заранее. */
export const STORY_PHOTOS = STORY_SERIES.flatMap((meta) =>
  meta.slides.flatMap((visual) => ('image' in visual ? [visual.image] : [])),
);

/**
 * Серии с текстом текущей локали. returnObjects отдаёт массив слайдов из JSON;
 * на случай битого бандла локали — пустой массив.
 */
export function useStorySeries(): StorySeries[] {
  const { t } = useTranslation();
  const site = cabinetHost();

  return [...STORY_SERIES]
    .sort((a, b) => a.order - b.order)
    .map((meta) => {
      const coverTitle = t(`stories.series.${meta.id}.coverTitle`);
      const slides = t(`stories.series.${meta.id}.slides`, {
        returnObjects: true,
        site,
      }) as unknown as StorySlideContent[];
      return {
        meta,
        coverTitle,
        slides: Array.isArray(slides) ? slides.filter((s) => s?.title) : [],
      };
    });
}
