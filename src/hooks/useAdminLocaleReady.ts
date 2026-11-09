import { useEffect, useState } from 'react';

import { loadAdminLocale } from '@/i18n';

/** Страницы админки ждут свой словарь: он не входит в стартовую загрузку. */
export function useAdminLocaleReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAdminLocale().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return ready;
}
