/**
 * Анимированный фон кабинета. С 15.11.2026 он один — «чернила» (InkBackground):
 * 20 сторонних эффектов (aurora, boxes, vortex…) удалены. Старое значение type в базе
 * читается как «ink», 'none' — фон выключен.
 */
export type BackgroundType = 'ink' | 'none';

export interface AnimationConfig {
  enabled: boolean;
  type: BackgroundType;
  /** Яркость разводов, 0.1–1. */
  opacity: number;
}

/** Нет настройки или она битая — фона нет: страница остаётся на статичном фоне темы. */
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  enabled: false,
  type: 'ink',
  opacity: 1,
};
