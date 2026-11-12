import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import ru from '@/locales/ru.json';
import en from '@/locales/en.json';
import { STORY_CTA_ROUTES, STORY_SERIES, storyPhotos } from './registry';
import { stepBack, stepForward, tapZone } from './StoryViewer';

type LocaleTree = {
  stories?: {
    series?: Record<string, { coverTitle?: unknown; slides?: unknown }>;
  };
};

const LOCALES: Record<string, LocaleTree> = { ru, en };

function slidesOf(lng: string, seriesId: string) {
  const raw = LOCALES[lng]?.stories?.series?.[seriesId]?.slides;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : null;
}

describe('реестр серий сторис', () => {
  it('серии с акцентом, иконкой и уникальным порядком', () => {
    expect(STORY_SERIES.length).toBeGreaterThanOrEqual(3);
    for (const meta of STORY_SERIES) {
      expect(meta.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof meta.icon).toBe('function');
      expect(meta.order).toBeGreaterThan(0);
    }
    expect(new Set(STORY_SERIES.map((s) => s.order)).size).toBe(STORY_SERIES.length);
  });

  it('у каждой серии 3–5 слайдов, и визуал есть у каждого слайда', () => {
    for (const meta of STORY_SERIES) {
      const slides = slidesOf('ru', meta.id);
      expect(slides, `ru: серия ${meta.id}`).not.toBeNull();
      expect(slides!.length).toBeGreaterThanOrEqual(3);
      expect(slides!.length).toBeLessThanOrEqual(5);
      expect(meta.slides.length, `визуал серии ${meta.id}`).toBe(slides!.length);
    }
  });

  it('серия appstore-region показывает реальные скриншоты шагов, и они лежат в public/', () => {
    const meta = STORY_SERIES.find((s) => s.id === 'appstore-region')!;
    expect(meta.slides.length).toBe(5);
    for (const v of meta.slides) {
      expect('image' in v).toBe(true);
      const src = (v as { image: string }).image;
      expect(src.startsWith('/img/story-region-')).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../public', src.slice(1)))).toBe(true);
    }
  });

  it('в локалях только текст — картинки и визуал живут в реестре', () => {
    for (const lng of Object.keys(LOCALES)) {
      for (const meta of STORY_SERIES) {
        for (const slide of slidesOf(lng, meta.id)!) {
          expect(Object.keys(slide).sort()).toEqual(
            'ctaLabel' in slide ? ['ctaLabel', 'subtitle', 'title'] : ['subtitle', 'title'],
          );
        }
      }
    }
  });

  it('все четыре локали полны: те же серии и те же слайды', () => {
    for (const meta of STORY_SERIES) {
      const ruSlides = slidesOf('ru', meta.id)!;
      for (const lng of ['en']) {
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

/**
 * Жалоба владельца 12.11: с последней страницы «вперёд» открывало соседнюю тему
 * (из «Как подключить» — в «Нет INCY в App Store»). История — одна тема: вперёд
 * с последнего слайда закрывает её, назад с первого никуда не уводит.
 */
describe('шаги внутри одной истории', () => {
  it('вперёд — следующий слайд той же истории', () => {
    expect(stepForward(0, 3)).toBe(1);
    expect(stepForward(1, 3)).toBe(2);
  });

  it('вперёд с последнего слайда закрывает историю, а не открывает соседнюю', () => {
    expect(stepForward(2, 3)).toBe('close');
    expect(stepForward(4, 5)).toBe('close');
    expect(stepForward(0, 1)).toBe('close');
  });

  it('пустая история закрывается сразу', () => {
    expect(stepForward(0, 0)).toBe('close');
  });

  it('у каждой темы последний шаг ведёт к закрытию, какой бы длины она ни была', () => {
    for (const meta of STORY_SERIES) {
      const count = meta.slides.length;
      for (let i = 0; i < count - 1; i += 1) expect(stepForward(i, count)).toBe(i + 1);
      expect(stepForward(count - 1, count), meta.id).toBe('close');
    }
  });

  it('назад — предыдущий слайд, с первого — остаёмся на первом', () => {
    expect(stepBack(2)).toBe(1);
    expect(stepBack(1)).toBe(0);
    expect(stepBack(0)).toBe(0);
  });
});

describe('предзагрузка фото', () => {
  it('грузятся фото только открытой темы', () => {
    expect(storyPhotos('appstore-region')).toEqual([
      '/img/story-region-1.jpg',
      '/img/story-region-2.jpg',
      '/img/story-region-3.jpg',
      '/img/story-region-4.jpg',
      '/img/story-region-5.jpg',
    ]);
    expect(storyPhotos('connect')).toEqual([]);
  });

  it('неизвестная тема — пусто, без падения', () => {
    expect(storyPhotos('nope')).toEqual([]);
    expect(storyPhotos(undefined)).toEqual([]);
  });
});
