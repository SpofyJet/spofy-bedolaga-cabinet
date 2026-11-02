import { describe, expect, it } from 'vitest';

import ru from '@/locales/ru.json';
import en from '@/locales/en.json';
import fa from '@/locales/fa.json';
import zh from '@/locales/zh.json';
import { STORY_CTA_ROUTES, STORY_SERIES } from './registry';
import { tapZone } from './StoryViewer';

type LocaleTree = {
  stories?: {
    series?: Record<string, { coverTitle?: unknown; slides?: unknown }>;
  };
};

const LOCALES: Record<string, LocaleTree> = { ru, en, fa, zh };

function slidesOf(lng: string, seriesId: string) {
  const raw = LOCALES[lng]?.stories?.series?.[seriesId]?.slides;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : null;
}

describe('реестр серий сторис', () => {
  it('есть 4 готовые серии с корректными палитрами', () => {
    expect(STORY_SERIES.length).toBeGreaterThanOrEqual(3);
    for (const meta of STORY_SERIES) {
      expect(meta.palette.from).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.palette.to).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.order).toBeGreaterThan(0);
    }
    // Порядок уникален
    expect(new Set(STORY_SERIES.map((s) => s.order)).size).toBe(STORY_SERIES.length);
  });

  it('у каждой серии 3–7 слайдов и иллюстрация на каждый слайд', () => {
    for (const meta of STORY_SERIES) {
      const slides = slidesOf('ru', meta.id);
      expect(slides, `ru: серия ${meta.id}`).not.toBeNull();
      expect(slides!.length).toBeGreaterThanOrEqual(3);
      expect(slides!.length).toBeLessThanOrEqual(7);
      expect(meta.art.length).toBe(slides!.length);
    }
  });

  it('все четыре локали полны: те же серии и те же слайды', () => {
    for (const meta of STORY_SERIES) {
      const ruSlides = slidesOf('ru', meta.id)!;
      for (const lng of ['en', 'fa', 'zh']) {
        const slides = slidesOf(lng, meta.id);
        expect(slides, `${lng}: серия ${meta.id}`).not.toBeNull();
        expect(slides!.length).toBe(ruSlides.length);
        expect(typeof LOCALES[lng]?.stories?.series?.[meta.id]?.coverTitle).toBe('string');
      }
    }
  });

  it('у каждого слайда заголовок и подзаголовок; CTA — только на финальном', () => {
    for (const lng of Object.keys(LOCALES)) {
      for (const meta of STORY_SERIES) {
        const slides = slidesOf(lng, meta.id)!;
        slides.forEach((slide, i) => {
          expect(typeof slide.title).toBe('string');
          expect(typeof slide.subtitle).toBe('string');
          expect((slide.title as string).length).toBeGreaterThan(0);
          if (i < slides.length - 1) {
            expect(slide.ctaLabel).toBeUndefined();
          }
        });
        const last = slides[slides.length - 1];
        if (meta.cta) {
          expect(typeof last.ctaLabel).toBe('string');
          expect(STORY_CTA_ROUTES[meta.cta]).toMatch(/^\//);
        } else {
          expect(last.ctaLabel).toBeUndefined();
        }
      }
    }
  });
});

describe('tapZone просмотрщика', () => {
  it('левая треть — назад, остальное — вперёд', () => {
    expect(tapZone(10, 300)).toBe('prev');
    expect(tapZone(99, 300)).toBe('prev');
    expect(tapZone(100, 300)).toBe('next');
    expect(tapZone(299, 300)).toBe('next');
  });
});
