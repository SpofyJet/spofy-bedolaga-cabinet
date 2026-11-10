/** Сколько снизу занимает нижняя панель навигации: блок под ней не считается видимым. */
const BOTTOM_NAV_PX = 96;
const GAP_PX = 12;

/**
 * Прокрутка к блоку страницы с учётом шапки Telegram: в fullscreen Mini App она лежит поверх
 * страницы, и scrollIntoView с block: 'start' уводит начало блока под неё.
 *
 * onlyIfHidden: блок, который и так виден целиком, остаётся на месте.
 */
export function scrollToSection(
  element: HTMLElement | null,
  topInset: number,
  { onlyIfHidden = false }: { onlyIfHidden?: boolean } = {},
): void {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const top = topInset + GAP_PX;
  const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
  if (onlyIfHidden && rect.top >= top && rect.bottom <= visibleHeight - BOTTOM_NAV_PX) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: window.scrollY + rect.top - top, behavior: reduce ? 'auto' : 'smooth' });
}
