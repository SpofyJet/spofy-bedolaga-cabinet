/**
 * Цвет со смыслом (v12, палитра владельца).
 *
 * Палитра одноцветная: Primary #0B1F3B, Accent #2563EB, Secondary #60A5FA,
 * Surface #DBEAFE, Background #F0F7FF. Поэтому важность показывает светлота, а не оттенок:
 * - фон и карточки — самые спокойные ступени, текст — Primary;
 * - главная кнопка экрана (cta) — самая сильная заливка, одна на экран;
 * - синий (accent) — ссылки, активная вкладка, переключатели, выбор, плитки иконок;
 * - зелёный / жёлтый / красный — только состояние (работает, скоро, закончилась).
 *
 * Разноцветных плиток по темам (голубой, бирюзовый, розовый, фиолетовый…) больше нет:
 * смысл несёт иконка, а цвет занят состоянием. Имена тонов оставлены, чтобы экраны
 * не менялись и тему можно было развести обратно в одном месте.
 *
 * Строки классов литеральные: Tailwind собирает их по тексту.
 */
export type Tone =
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'muted'
  | 'devices'
  | 'plan'
  | 'money'
  | 'friends'
  | 'promo'
  | 'account'
  | 'notify';

const BLUE_TILE = 'bg-accent-400/[0.14] text-accent-400 light:bg-accent-100 light:text-accent-500';
const BLUE_CHIP = 'border-accent-500/30 bg-accent-500/10 text-accent-300';

/** Плитка иконки: фон + цвет иконки. */
export const TONE_TILE: Record<Tone, string> = {
  accent: BLUE_TILE,
  success: 'bg-success-500/10 text-success-400',
  warning: 'bg-warning-500/10 text-warning-400',
  error: 'bg-error-500/10 text-error-400',
  muted: 'bg-dark-800/80 text-dark-300',
  devices: BLUE_TILE,
  plan: BLUE_TILE,
  money: BLUE_TILE,
  friends: BLUE_TILE,
  promo: BLUE_TILE,
  account: BLUE_TILE,
  notify: BLUE_TILE,
};

/** Чип с подписью (текст, не иконка: в светлой теме 700 ради контраста). */
export const TONE_CHIP: Record<Tone, string> = {
  accent: 'border-accent-500/30 bg-accent-500/10 text-accent-300',
  success: 'border-success-500/25 bg-success-500/10 text-success-400',
  warning: 'border-warning-500/25 bg-warning-500/10 text-warning-400',
  error: 'border-error-500/25 bg-error-500/10 text-error-400',
  muted: 'border-dark-700/60 bg-dark-800/60 text-dark-300',
  devices: BLUE_CHIP,
  plan: BLUE_CHIP,
  money: BLUE_CHIP,
  friends: BLUE_CHIP,
  promo: BLUE_CHIP,
  account: BLUE_CHIP,
  notify: BLUE_CHIP,
};
