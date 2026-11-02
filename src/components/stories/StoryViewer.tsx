import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { PiXBold } from 'react-icons/pi';

import { STORY_CTA_ROUTES, useStorySeries } from './registry';
import { StoryArtwork } from './artwork';
import { markStoryRead } from './useStoryRead';

const SLIDE_DURATION_MS = 6000;
const SWIPE_THRESHOLD_PX = 56;
const TAP_MAX_DURATION_MS = 300;
const TAP_MAX_DISTANCE_PX = 12;

/** Зона тапа по горизонтали: левая треть — назад, остальное — вперёд. */
export function tapZone(offsetX: number, width: number): 'prev' | 'next' {
  return offsetX < width / 3 ? 'prev' : 'next';
}

interface StoryViewerProps {
  initialIndex: number;
  onClose: () => void;
}

export function StoryViewer({ initialIndex, onClose }: StoryViewerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const seriesList = useStorySeries();

  const [seriesIdx, setSeriesIdx] = useState(initialIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  // Индексы и пауза в ref — rAF-цикл не должен зависеть от ререндеров.
  const seriesRef = useRef(seriesIdx);
  const slideRef = useRef(slideIdx);
  const pausedRef = useRef(paused);
  seriesRef.current = seriesIdx;
  slideRef.current = slideIdx;
  pausedRef.current = paused;

  const fillRef = useRef<HTMLDivElement | null>(null);
  const holdStart = useRef<{ x: number; y: number; t: number; consumed: boolean } | null>(null);

  const series = seriesList[seriesIdx];
  const slides = series?.slides ?? [];

  const goTo = useCallback((nextSeries: number, nextSlide: number, dir: number) => {
    setDirection(dir);
    setSeriesIdx(nextSeries);
    setSlideIdx(nextSlide);
  }, []);

  const next = useCallback(() => {
    const s = seriesRef.current;
    const i = slideRef.current;
    const total = seriesList.length;
    const count = seriesList[s]?.slides.length ?? 0;
    if (i < count - 1) {
      goTo(s, i + 1, 1);
    } else if (s < total - 1) {
      goTo(s + 1, 0, 1);
    } else {
      onClose();
    }
  }, [seriesList, goTo, onClose]);

  const prev = useCallback(() => {
    const s = seriesRef.current;
    const i = slideRef.current;
    if (i > 0) {
      goTo(s, i - 1, -1);
    } else if (s > 0) {
      goTo(s - 1, (seriesList[s - 1]?.slides.length ?? 1) - 1, -1);
    }
  }, [seriesList, goTo]);

  // next/prev для таймера — через ref: эффект ниже должен перезапускаться
  // ТОЛЬКО по смене слайда/серии, а не по каждому рендеру (иначе пауза
  // обнуляла бы прогресс).
  const nextRef = useRef(next);
  nextRef.current = next;

  // Автопереход: rAF-прогресс активного слайда, пауза при удержании.
  useEffect(() => {
    if (slides.length === 0) return;
    let raf = 0;
    const start = performance.now();
    let last = start;
    // Пауза при удержании: удержанное время вычитаем из прогресса.
    let pausedMs = 0;
    const tick = (now: number) => {
      if (pausedRef.current) {
        pausedMs += now - last;
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      last = now;
      const elapsed = now - start - pausedMs;
      const ratio = Math.min(1, elapsed / SLIDE_DURATION_MS);
      if (fillRef.current) fillRef.current.style.width = `${ratio * 100}%`;
      if (ratio >= 1) {
        nextRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seriesIdx, slideIdx, slides.length]);

  // Блок скролла страницы под просмотрщиком.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Клавиатура: Esc — закрыть, стрелки — листать.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  // Просмотр засчитан с первого кадра: бейдж «не прочитано» не должен
  // мигать обратно, если пользователь закрыл серию на середине.
  useEffect(() => {
    const id = seriesList[seriesRef.current]?.meta.id;
    if (id) markStoryRead(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesIdx]);

  const handlePointerDown = (e: React.PointerEvent) => {
    holdStart.current = { x: e.clientX, y: e.clientY, t: performance.now(), consumed: false };
    setPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const hold = holdStart.current;
    if (!hold || hold.consumed) return;
    const dx = e.clientX - hold.x;
    const dy = e.clientY - hold.y;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.4) {
      hold.consumed = true;
      setPaused(false);
      onClose();
    } else if (dx < -SWIPE_THRESHOLD_PX) {
      hold.consumed = true;
      setPaused(false);
      next();
    } else if (dx > SWIPE_THRESHOLD_PX) {
      hold.consumed = true;
      setPaused(false);
      prev();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const hold = holdStart.current;
    holdStart.current = null;
    setPaused(false);
    if (!hold || hold.consumed) return;
    const dx = Math.abs(e.clientX - hold.x);
    const dy = Math.abs(e.clientY - hold.y);
    const dt = performance.now() - hold.t;
    if (dt < TAP_MAX_DURATION_MS && dx < TAP_MAX_DISTANCE_PX && dy < TAP_MAX_DISTANCE_PX) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      if (tapZone(offsetX, rect.width) === 'next') next();
      else prev();
    }
  };

  if (!series) return null;
  const { meta } = series;
  const slide = slides[slideIdx];
  if (!slide) return null;
  const isLastSlide = slideIdx === slides.length - 1;

  const handleCta = () => {
    if (!meta.cta) return;
    onClose();
    navigate(STORY_CTA_ROUTES[meta.cta]);
  };

  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={series.coverTitle}>
      <div className="story-viewer-frame">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={`${meta.id}-${slideIdx}`}
            className="story-slide"
            style={{
              background: `linear-gradient(165deg, ${meta.palette.from} 0%, ${meta.palette.to} 78%)`,
            }}
            custom={direction}
            initial={{ opacity: 0, x: direction * 90 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -90 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              holdStart.current = null;
              setPaused(false);
            }}
          >
            {/* Прогресс-бары всей серии + моно-метка серии */}
            <div className="story-progress-list">
              {slides.map((_, i) => (
                <div key={i} className="story-progress-track">
                  <div
                    className="story-progress-fill"
                    ref={i === slideIdx ? fillRef : undefined}
                    style={{
                      width: i < slideIdx ? '100%' : '0%',
                      transition: i < slideIdx ? 'width 0.2s ease' : undefined,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="story-meta font-mono">
              <span className="story-meta-index">
                {String(slideIdx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </span>
              <span className="story-meta-title">{series.coverTitle}</span>
            </div>

            <div className="story-head">
              <h2 className="story-title font-display">{slide.title}</h2>
              <p className="story-subtitle">{slide.subtitle}</p>
            </div>

            <StoryArtwork art={meta.art[slideIdx] ?? 'cta-check'} palette={meta.palette} />

            {isLastSlide && slide.ctaLabel && meta.cta && (
              <button type="button" className="story-cta" onClick={handleCta}>
                {slide.ctaLabel}
              </button>
            )}
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          className="story-close"
          onClick={onClose}
          aria-label={t('stories.close', 'Закрыть')}
        >
          <PiXBold className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
