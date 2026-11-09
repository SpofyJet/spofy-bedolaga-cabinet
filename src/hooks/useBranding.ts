import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { useTelegramSDK, setCachedFullscreenEnabled } from '@/hooks/useTelegramSDK';
import {
  brandingApi,
  getCachedBranding,
  setCachedBranding,
  preloadLogo,
  isLogoPreloaded,
  useLogoBlobUrl,
} from '@/api/branding';

const FALLBACK_NAME = import.meta.env.VITE_APP_NAME || 'Cabinet';
const FALLBACK_LOGO = import.meta.env.VITE_APP_LOGO || 'S';

export function useBranding() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { isTelegramWebApp, requestFullscreen } = useTelegramSDK();

  // Branding data
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: async () => {
      const data = await brandingApi.getBranding();
      setCachedBranding(data);
      await preloadLogo(data);
      return data;
    },
    initialData: getCachedBranding() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 60000,
    enabled: isAuthenticated,
  });

  const appName = branding ? branding.name : FALLBACK_NAME;
  // Пока брендинг не пришёл, плитка пустая: буква по умолчанию («V») мелькала и сменялась логотипом.
  const logoLetter = branding ? branding.logo_letter || FALLBACK_LOGO : '';
  const hasCustomLogo = branding?.has_custom_logo || false;
  const logoBlobUrl = useLogoBlobUrl();
  const logoUrl = hasCustomLogo ? logoBlobUrl : null;

  // Заголовок, фавикон и метатеги ведёт useDocumentBranding на уровне приложения.

  // Fullscreen setting from server
  const { data: fullscreenSetting } = useQuery({
    queryKey: ['fullscreen-enabled'],
    queryFn: brandingApi.getFullscreenEnabled,
    staleTime: 60000,
  });

  const fullscreenRequestedRef = useRef(false);

  useEffect(() => {
    if (!fullscreenSetting || !isTelegramWebApp) return;
    setCachedFullscreenEnabled(fullscreenSetting.enabled);
    if (fullscreenSetting.enabled && !fullscreenRequestedRef.current) {
      fullscreenRequestedRef.current = true;
      requestFullscreen();
    }
  }, [fullscreenSetting, isTelegramWebApp, requestFullscreen]);

  return {
    appName,
    logoLetter,
    /** Брендинг уже известен (из кэша или с сервера): до этого буква — запасная из .env. */
    brandingReady: branding !== undefined,
    hasCustomLogo,
    logoUrl,
    isLogoPreloaded,
  };
}
