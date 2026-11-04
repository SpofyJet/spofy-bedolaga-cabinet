/**
 * Цвет со смыслом (v11). Раньше синим было всё: фон, карточки, иконки,
 * кнопки, чипы — страница читалась одним пятном.
 *
 * Схема «тёмно-синий + синий + капля тёплого» (как в разборе «дорогого» сочетания
 * тёмно-синий / electric blue / оранжевый):
 * - база — тёмно-синий: фон и карточки (карточки заметно светлее фона);
 * - синий (accent) — ссылки, активная вкладка, переключатели, выбор;
 * - коралл (cta, от красного в логотипе Spofy) — ТОЛЬКО главная кнопка экрана.
 *   Это «капля», которая делает синее на синем живым; больше нигде его нет,
 *   иначе он перестаёт выделяться;
 * - зелёный / жёлтый / красный — только состояние (работает, скоро, закончилась);
 * - в строках списков (профиль, условия, история, подписка) иконка в плитке
 *   спокойной краски своей темы — одна и та же на всех экранах и на странице
 *   подписки; в рядах плиток на главной иконки синие, чтобы не спорить с кораллом:
 *     устройства и подключение — sky, подписка и тарифы — teal,
 *     деньги — amber, друзья и подарки — pink, промокоды — violet
 *     (как пробный период), аккаунт, почта и ссылка подписки (личный ключ) —
 *     indigo, уведомления — orange, настройки и документы — серый (muted).
 *
 * Плитка — 12 % заливки и иконка 400 (в светлой теме 600, иначе на белом
 * иконка теряется). Строки классов литеральные: Tailwind собирает их по тексту.
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

/** Плитка иконки: фон + цвет иконки. */
export const TONE_TILE: Record<Tone, string> = {
  accent: 'bg-accent-500/10 text-accent-400',
  success: 'bg-success-500/10 text-success-400',
  warning: 'bg-warning-500/10 text-warning-400',
  error: 'bg-error-500/10 text-error-400',
  muted: 'bg-dark-800/80 text-dark-300',
  devices: 'bg-sky-500/[0.12] text-sky-400 light:bg-sky-500/10 light:text-sky-600',
  plan: 'bg-teal-500/[0.12] text-teal-400 light:bg-teal-500/10 light:text-teal-600',
  money: 'bg-amber-500/[0.12] text-amber-400 light:bg-amber-500/10 light:text-amber-600',
  friends: 'bg-pink-500/[0.12] text-pink-400 light:bg-pink-500/10 light:text-pink-600',
  promo: 'bg-violet-500/[0.14] text-violet-400 light:bg-violet-500/10 light:text-violet-600',
  account: 'bg-indigo-500/[0.14] text-indigo-300 light:bg-indigo-500/10 light:text-indigo-600',
  notify: 'bg-orange-500/[0.12] text-orange-400 light:bg-orange-500/10 light:text-orange-600',
};

/** Чип с подписью (текст, не иконка: в светлой теме 700 ради контраста). */
export const TONE_CHIP: Record<Tone, string> = {
  accent: 'border-accent-500/30 bg-accent-500/10 text-accent-300',
  success: 'border-success-500/25 bg-success-500/10 text-success-400',
  warning: 'border-warning-500/25 bg-warning-500/10 text-warning-400',
  error: 'border-error-500/25 bg-error-500/10 text-error-400',
  muted: 'border-dark-700/60 bg-dark-800/60 text-dark-300',
  devices: 'border-sky-500/25 bg-sky-500/10 text-sky-300 light:text-sky-700',
  plan: 'border-teal-500/25 bg-teal-500/10 text-teal-300 light:text-teal-700',
  money: 'border-amber-500/25 bg-amber-500/10 text-amber-300 light:text-amber-700',
  friends: 'border-pink-500/25 bg-pink-500/10 text-pink-300 light:text-pink-700',
  promo: 'border-violet-500/30 bg-violet-500/10 text-violet-300 light:text-violet-700',
  account: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 light:text-indigo-700',
  notify: 'border-orange-500/25 bg-orange-500/10 text-orange-300 light:text-orange-700',
};
