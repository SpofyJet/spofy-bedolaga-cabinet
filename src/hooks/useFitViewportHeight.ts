import { useCallback, useEffect, useRef } from 'react';

/**
 * Высота элемента — ровно до низа видимой области (минус место под нижнюю панель, если она на этом
 * экране есть). Для экранов-мессенджеров: шапка и поле ввода всегда на экране, прокручивается
 * только лента. Учитывает клавиатуру (visualViewport) и вырезы Telegram: верх элемента меряется по
 * факту, а не угадывается.
 *
 * Возвращает callback-ref: страница чата сначала рисует заглушку загрузки, потом сам чат — и
 * меряется каждый новый элемент.
 */
export function useFitViewportHeight<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);

  const ref = useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;

    // Сколько занимает нижняя панель: CSS-переменная читается там, где она
    // задана для этого экрана ([data-mobile-nav="off"] обнуляет запас под панель),
    // а не у <body>, где всегда стоит значение «панель есть».
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;height:var(--mobile-nav-clearance,0px)';
    (el.closest('[data-mobile-nav]') ?? document.body).appendChild(probe);

    const update = () => {
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const isDesktop = window.matchMedia?.('(min-width: 1024px)').matches ?? false;
      // +8 — нижний отступ main (pb: clearance + 0.5rem), чтобы документ не прокручивался.
      const bottom = (isDesktop ? 24 : probe.getBoundingClientRect().height) + 8;
      el.style.height = `${Math.max(320, Math.floor(viewport - top - bottom))}px`;
    };

    window.scrollTo?.(0, 0);
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(document.documentElement);
    cleanup.current = () => {
      vv?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
      probe.remove();
    };
  }, []);

  useEffect(() => () => cleanup.current?.(), []);

  return ref;
}
