import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PiXBold } from 'react-icons/pi';

import { useBranding } from '@/hooks/useBranding';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { STORY_CTA_ROUTES, storyPhotos, useStorySeries } from './registry';
import { markStoryRead } from './useStoryRead';
import { StoryVisual } from './visuals';

const SLIDE_DURATION_MS = 8000;
const SWIPE_THRESHOLD_PX = 56;
const TAP_MAX_DURATION_MS = 300;
const TAP_MAX_DISTANCE_PX = 12;

/** Зона тапа по горизонтали: левая треть — назад, остальное — вперёд. */
export function tapZone(offsetX: number, width: number): 'prev' | 'next' {
  return offsetX < width / 3 ? 'prev' : 'next';
}

/**
 * Шаг «вперёд» внутри одной истории. С последнего слайда история закрывается:
 * в соседнюю тему просмотрщик сам не переходит — человек открыл «Как
 * подключить» и не просил показывать ему «Нет INCY в App Store».
 */
export function stepForward(slide: number, count: number): number | 'close' {
  return slide < count - 1 ? slide + 1 : 'close';
}

/** Шаг «назад»: с первого слайда идти некуда — остаёмся на нём. */
export function stepBack(slide: number): number {
  return Math.max(0, slide - 1);
}

/** Кнопки поверх слайда не должны листать сторис и ставить их на паузу. */
const stopPointer = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onPointerUp: (e: React.PointerEvent) => e.stopPropagation(),
};

/**
 * Иллюстрация слайда сжимается, если не помещается между текстом и кнопкой.
 * Без этого на низком окне Telegram (≈600 px) она стоит по центру и вылезает
 * и вверх на подзаголовок, и вниз под кнопку.
 */
const VISUAL_GLOW_PX = 24; // кольца и тени выходят за рамку блока
const VISUAL_MIN_SCALE = 0.55;

function FitVisual({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fitScale = () => {
      const cs = getComputedStyle(outer);
      const avail = outer.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      // offsetHeight не учитывает transform — это естественная высота.
      const need = inner.offsetHeight + VISUAL_GLOW_PX;
      const next = need > avail && avail > 0 ? Math.max(VISUAL_MIN_SCALE, avail / need) : 1;
      setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    };
    fitScale();
    const ro = new ResizeObserver(fitScale);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="story-visual">
      <div
        ref={innerRef}
        className="story-visual-fit"
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

interface StoryViewerProps {
  initialIndex: number;
  onClose: () => void;
}

export function StoryViewer({ initialIndex, onClose }: StoryViewerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const seriesList = useStorySeries();
  const { appName, logoUrl, hasCustomLogo, logoLetter } = useBranding();
  const { topSafeArea, bottomSafeArea } = useHeaderHeight();

  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Индекс слайда и пауза в ref — rAF-цикл не зависит от ререндеров.
  const slideRef = useRef(slideIdx);
  const pausedRef = useRef(paused);
  slideRef.current = slideIdx;
  pausedRef.current = paused;

  const fillRef = useRef<HTMLDivElement | null>(null);
  const holdStart = useRef<{ x: number; y: number; t: number; consumed: boolean } | null>(null);
  // Касание признаётся тапом на pointerup, а действует на click. Если закрыть
  // просмотрщик уже на pointerup, click того же касания достаётся главной под
  // ним и открывает ссылку, оказавшуюся под пальцем.
  const tapPending = useRef(false);

  // Открытая история остаётся одной и той же до закрытия: листаются только её слайды.
  const series = seriesList[initialIndex];
  const slides = series?.slides ?? [];
  const slideCount = slides.length;
  const seriesId = series?.meta.id;

  const next = useCallback(() => {
    const target = stepForward(slideRef.current, slideCount);
    if (target === 'close') onClose();
    else setSlideIdx(target);
  }, [slideCount, onClose]);

  const prev = useCallback(() => {
    setSlideIdx(stepBack(slideRef.current));
  }, []);

  // Таймер перезапускается только по смене слайда.
  const nextRef = useRef(next);
  nextRef.current = next;

  // biome-ignore lint/correctness/useExhaustiveDependencies: slideIdx — намеренный перезапуск таймера на каждом слайде
  useEffect(() => {
    if (slideCount === 0) return;
    let raf = 0;
    const start = performance.now();
    let last = start;
    let pausedMs = 0;
    const tick = (now: number) => {
      if (pausedRef.current) {
        pausedMs += now - last;
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      last = now;
      const ratio = Math.min(1, (now - start - pausedMs) / SLIDE_DURATION_MS);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`;
      if (ratio >= 1) {
        // Последний слайд сам не листается и не закрывается: на нём кнопка
        // действия, и человек дочитывает шаг столько, сколько ему нужно.
        if (slideRef.current < slideCount - 1) nextRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slideIdx, slideCount]);

  // Страница под просмотрщиком не скроллится.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Esc — закрыть, стрелки — листать.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  // Просмотр засчитан с первого кадра серии.
  useEffect(() => {
    if (seriesId) markStoryRead(seriesId);
  }, [seriesId]);

  // Фото открытой серии — сразу при открытии и декодированными: иначе на следующем
  // слайде картинка догружалась уже на экране. Ссылки держим в ref, чтобы браузер
  // не выгрузил декодированные кадры, пока просмотрщик открыт.
  const photosRef = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    photosRef.current = storyPhotos(seriesId).map((src) => {
      const img = new Image();
      img.src = src;
      img.decode?.().catch(() => undefined);
      return img;
    });
  }, [seriesId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    holdStart.current = { x: e.clientX, y: e.clientY, t: performance.now(), consumed: false };
    tapPending.current = false;
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
    tapPending.current =
      dt < TAP_MAX_DURATION_MS && dx < TAP_MAX_DISTANCE_PX && dy < TAP_MAX_DISTANCE_PX;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!tapPending.current) return;
    tapPending.current = false;
    // Кнопка действия лежит внутри слоя жестов: её нажатие — не листание.
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (tapZone(e.clientX - rect.left, rect.width) === 'next') next();
    else prev();
  };

  if (!series) return null;
  const { meta } = series;
  const slide = slides[slideIdx];
  if (!slide) return null;
  const visual = meta.slides[slideIdx];
  const isLastSlide = slideIdx === slides.length - 1;

  const handleCta = () => {
    if (!meta.cta) return;
    onClose();
    navigate(STORY_CTA_ROUTES[meta.cta]);
  };

  return createPortal(
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={series.coverTitle}>
      <div
        className="story-viewer-frame"
        style={
          {
            '--story-accent': meta.accent,
            '--story-top': `${topSafeArea}px`,
            '--story-bottom': `${bottomSafeArea}px`,
          } as React.CSSProperties
        }
      >
        <div className="story-chrome">
          <div className="story-progress-list" aria-hidden>
            {slides.map((_, i) => (
              <div key={i} className="story-progress-track">
                <div
                  className="story-progress-fill"
                  ref={i === slideIdx ? fillRef : undefined}
                  style={{ transform: `scaleX(${i < slideIdx ? 1 : 0})` }}
                />
              </div>
            ))}
          </div>
          <div className="story-header">
            <span className="story-brand-logo">
              {hasCustomLogo && logoUrl ? <img src={logoUrl} alt="" /> : <span>{logoLetter}</span>}
            </span>
            <span className="story-brand-name">{appName}</span>
            <span className="story-header-dot" aria-hidden>
              ·
            </span>
            <span className="story-header-series">{series.coverTitle}</span>
            <button
              type="button"
              className="story-close"
              onClick={onClose}
              aria-label={t('stories.close', 'Закрыть')}
              {...stopPointer}
            >
              <PiXBold className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Жесты — на постоянном слое: он не пересоздаётся при смене слайда, поэтому
            свайп не обрывается, а старый и новый слайды не рисуются друг поверх друга.
            Слайд меняется мгновенно, без анимации: новый слайд, проявляющийся из
            прозрачного, давал моргание пустым фоном на каждом переключении. */}
        <div
          className="story-slide"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            holdStart.current = null;
            tapPending.current = false;
            setPaused(false);
          }}
          onClick={handleClick}
        >
          <div key={`${meta.id}-${slideIdx}`} className="story-slide-inner">
            <div className="story-text">
              {slides.length > 1 && (
                <span className="story-step">
                  {t('stories.step', 'Шаг {{n}} из {{total}}', {
                    n: slideIdx + 1,
                    total: slides.length,
                  })}
                </span>
              )}
              <h2 className="story-title">{slide.title}</h2>
              <p className="story-subtitle">{slide.subtitle}</p>
            </div>

            {visual && 'image' in visual ? (
              <div className="story-visual">
                <img
                  className="story-photo"
                  src={visual.image}
                  alt=""
                  decoding="sync"
                  draggable={false}
                />
              </div>
            ) : visual ? (
              <FitVisual>
                <StoryVisual name={visual.visual} accent={meta.accent} />
              </FitVisual>
            ) : (
              <div className="story-visual" />
            )}

            <div className="story-footer">
              {isLastSlide && slide.ctaLabel && meta.cta ? (
                <button type="button" className="story-cta" onClick={handleCta} {...stopPointer}>
                  {slide.ctaLabel}
                </button>
              ) : (
                <span className="story-hint">
                  {t('stories.tapHint', 'Нажмите справа, чтобы продолжить')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
