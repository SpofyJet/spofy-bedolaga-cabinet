import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { brandingApi } from '@/api/branding';
import { getCachedConfig, setCachedConfig } from '@/utils/backgroundConfig';
import { InkBackground } from './InkBackground';
import { DEFAULT_ANIMATION_CONFIG } from './types';

/**
 * Анимированный фон под всем кабинетом: «чернила», если включён в админке.
 * Слой под статичным свечением темы (body::after, z-index -1) и под содержимым.
 */
export function BackgroundRenderer() {
  const { data: config } = useQuery({
    queryKey: ['animation-config'],
    queryFn: async () => {
      const result = await brandingApi.getAnimationConfig();
      setCachedConfig(result);
      return result;
    },
    initialData: getCachedConfig() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  });

  const effective = config ?? DEFAULT_ANIMATION_CONFIG;
  if (!effective.enabled || effective.type === 'none') return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: -2 }}>
      <InkBackground opacity={effective.opacity} />
    </div>,
    document.body,
  );
}
