import { useLayoutEffect, useRef } from 'react';

/**
 * Высота элемента — ровно до низа видимой области (минус место под нижнюю
 * панель). Для экранов-мессенджеров: шапка и поле ввода всегда на экране,
 * прокручивается только лента. Учитывает клавиатуру (visualViewport) и
 * вырезы Telegram: верх элемента меряется по факту, а не угадывается.
 */
export function useFitViewportHeight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Сколько занимает нижняя панель: значение CSS-переменной через пробник.
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;height:var(--mobile-nav-clearance,0px)';
    document.body.appendChild(probe);

    const update = () => {
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const isDesktop = window.matchMedia?.('(min-width: 1024px)').matches ?? false;
      // +8 — нижний отступ main (pb: clearance + 0.5rem), чтобы документ не прокручивался.
      const clearance = probe.getBoundingClientRect().height;
      // Круглая кнопка «Подключить» выступает над панелью примерно на 28px —
      // поле ввода не должно уходить под неё (панель видна, если просвет > 40px).
      const fab = clearance > 40 ? 22 : 0;
      const bottom = (isDesktop ? 24 : clearance + fab) + 8;
      el.style.height = `${Math.max(320, Math.floor(viewport - top - bottom))}px`;
    };

    window.scrollTo?.(0, 0);
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(document.documentElement);
    return () => {
      vv?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
      probe.remove();
    };
  }, []);

  return ref;
}
