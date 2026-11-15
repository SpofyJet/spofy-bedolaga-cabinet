import type { AnimationConfig } from '@/components/backgrounds/types';

const ANIMATION_CACHE_KEY = 'cabinet_animation_config';
const MAX_CONFIG_JSON_LENGTH = 10_000;

/**
 * Настройка фона из API или кэша → AnimationConfig. null — если это не настройка фона.
 *
 * До 15.11.2026 эффектов было 20 (aurora, boxes…): любой из них теперь читается как
 * «чернила», а его opacity не берётся — она подбиралась под другой эффект (у boxes 0.1,
 * при ней «чернил» не видно). Яркость «чернил» — своя, по умолчанию 1.
 */
export function validateConfig(parsed: unknown): AnimationConfig | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.enabled !== 'boolean' || typeof obj.type !== 'string') return null;
  if (obj.type === 'none') return { enabled: obj.enabled, type: 'none', opacity: 1 };
  const own = obj.type === 'ink' && typeof obj.opacity === 'number' && Number.isFinite(obj.opacity);
  return {
    enabled: obj.enabled,
    type: 'ink',
    opacity: own ? Math.max(0.1, Math.min(1, obj.opacity as number)) : 1,
  };
}

export function getCachedConfig(): AnimationConfig | null {
  try {
    const cached = localStorage.getItem(ANIMATION_CACHE_KEY);
    if (!cached || cached.length > MAX_CONFIG_JSON_LENGTH) return null;
    return validateConfig(JSON.parse(cached));
  } catch {
    return null;
  }
}

export function setCachedConfig(config: AnimationConfig) {
  try {
    localStorage.setItem(ANIMATION_CACHE_KEY, JSON.stringify(config));
  } catch {}
}

export function setCachedAnimationConfig(config: AnimationConfig) {
  const validated = validateConfig(config);
  if (validated) setCachedConfig(validated);
}
