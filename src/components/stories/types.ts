/**
 * Типы системы сторис.
 *
 * Контент (заголовки, инструкции, CTA) живёт в JSON-локалях под ключом
 * `stories.series.<id>` — см. src/locales/{ru,en,fa,zh}.json. Тест
 * stories.test.ts проверяет парность ключей между всеми четырьмя локалями.
 * Rich-text не используется: только плоские строки, санитизация DOMPurify
 * для них не нужна (React экранирует вывод сам).
 */

/** Действие финального CTA — маршрут разрешается в registry.tsx. */
export type StoryCtaKey = 'connect' | 'purchase' | 'renew' | 'topup' | 'support';

export interface StorySlideContent {
  title: string;
  subtitle: string;
  /** Только финальный слайд серии может нести CTA. */
  ctaLabel?: string;
}

export interface StoryPalette {
  /** Градиент фона слайда (единый внутри серии). */
  from: string;
  to: string;
  /** Акцент подсветки выделенного элемента мокапа. */
  accent: string;
}

/** Ключ иллюстрации — параметрический CSS-мокап, см. artwork.tsx. */
export type StoryArtKey =
  | 'globe-intro'
  | 'account'
  | 'country'
  | 'payment-none'
  | 'cta-check'
  | 'connect'
  | 'install'
  | 'status'
  | 'refresh'
  | 'chat'
  | 'shield-intro'
  | 'alert-intro';

export interface StorySeriesMeta {
  id: string;
  /** Порядок в ленте. */
  order: number;
  coverImage: string;
  palette: StoryPalette;
  /** Иллюстрация для каждого слайда — длина совпадает с числом слайдов. */
  art: StoryArtKey[];
  /** CTA финального слайда (маршрут подставляется из STORY_CTA_ROUTES). */
  cta?: StoryCtaKey;
  /** Первая карточка в ленте — акцентная (чуть крупнее градиентная обложка). */
  featured?: boolean;
}

export interface StorySeries {
  meta: StorySeriesMeta;
  coverTitle: string;
  slides: StorySlideContent[];
}
