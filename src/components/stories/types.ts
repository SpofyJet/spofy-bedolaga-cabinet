/**
 * Типы системы сторис.
 *
 * Текст (обложка, заголовки, подписи, CTA) — в JSON-локалях под ключом
 * `stories.series.<id>`; визуал каждого слайда (фото или фрагмент интерфейса)
 * — в registry.tsx. Тест stories.test.ts сверяет число слайдов в реестре и во
 * всех четырёх локалях. Только плоские строки: React экранирует вывод сам.
 */

/** Действие финального CTA — маршрут разрешается в registry.tsx. */
export type StoryCtaKey = 'connect' | 'support' | 'devices';

/**
 * Фрагмент интерфейса на слайде: не иллюстрация «для красоты», а ровно то,
 * куда человеку нажать (кнопка, путь в настройках, список серверов…).
 */
export type StoryVisualKey =
  | 'install'
  | 'add-sub'
  | 'power'
  | 'refresh'
  | 'reset-path'
  | 'servers'
  | 'bypass'
  | 'support'
  | 'slots'
  | 'web'
  | 'tv-qr'
  | 'limit';

export type StorySlideVisual = { image: string } | { visual: StoryVisualKey };

export interface StorySlideContent {
  title: string;
  subtitle: string;
  /** Только финальный слайд серии может нести CTA. */
  ctaLabel?: string;
}

export interface StorySeriesMeta {
  id: string;
  /** Порядок в ленте. */
  order: number;
  /** Акцент серии: кольцо непрочитанной обложки, подсветка фрагментов, прогресс. */
  accent: string;
  /** Иконка обложки. */
  icon: React.ComponentType<{ className?: string }>;
  /** Визуал по слайдам — длина равна числу слайдов в локалях. */
  slides: readonly StorySlideVisual[];
  /** CTA финального слайда. */
  cta?: StoryCtaKey;
}

export interface StorySeries {
  meta: StorySeriesMeta;
  coverTitle: string;
  slides: StorySlideContent[];
}
