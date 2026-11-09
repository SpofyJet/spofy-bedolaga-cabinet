import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { brandingApi } from '@/api/branding';
import { referralApi } from '@/api/referral';
import { wheelApi } from '@/api/wheel';

// Последние известные значения флагов. Пока запросы в полёте, флаги были
// undefined -> табы «Рефералы»/«Колесо» появлялись с задержкой и нижняя
// навигация прыгала на каждом холодном старте. Кэш убирает layout shift;
// при изменении флага на бэке UI догонит после ответа запроса.
const FLAGS_CACHE_KEY = 'cabinet-feature-flags';

type CachedFlags = {
  referralEnabled?: boolean;
  wheelEnabled?: boolean;
  giftEnabled?: boolean;
};

function readFlagsCache(): CachedFlags {
  try {
    return JSON.parse(localStorage.getItem(FLAGS_CACHE_KEY) || '{}') as CachedFlags;
  } catch {
    return {};
  }
}

export function useFeatureFlags() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const cached = readFlagsCache();

  const { data: referralTerms } = useQuery({
    queryKey: ['referral-terms'],
    queryFn: referralApi.getReferralTerms,
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: false,
  });

  const { data: wheelConfig } = useQuery({
    queryKey: ['wheel-config'],
    queryFn: wheelApi.getConfig,
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: false,
  });

  const { data: giftConfig } = useQuery({
    queryKey: ['gift-enabled'],
    queryFn: brandingApi.getGiftEnabled,
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: false,
  });

  const flags = {
    referralEnabled: referralTerms ? referralTerms.is_enabled : cached.referralEnabled,
    wheelEnabled: wheelConfig ? wheelConfig.is_enabled : cached.wheelEnabled,
    giftEnabled: giftConfig ? giftConfig.enabled : cached.giftEnabled,
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: объект flags новый на каждый рендер, зависимости это его значения
  useEffect(() => {
    if (!referralTerms && !wheelConfig && !giftConfig) return;
    try {
      localStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify(flags));
    } catch {
      // квоты/приватный режим — некритично
    }
  }, [flags.referralEnabled, flags.wheelEnabled, flags.giftEnabled]);

  return flags;
}
