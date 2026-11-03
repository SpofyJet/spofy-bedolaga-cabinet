import incyLogo from './incy.svg';

/**
 * Иконки приложений для плиток выбора (как на sub.spofyltd.ru).
 * В конфиге панели только одноцветные глифы, поэтому:
 *  - INCY — настоящий логотип (incy.cc/favicon.svg, совпадает с иконкой в магазине);
 *  - Happ — белый глиф из svgLibrary на чёрной плитке, как иконка в магазине.
 */
export interface AppLogo {
  /** цветная иконка вместо глифа */
  src?: string;
  /** фон плитки под глифом из конфига */
  tile?: string;
}

const LOGOS: Record<string, AppLogo> = {
  incy: { src: incyLogo },
  happ: { tile: '#000000' },
};

/** «Happ», «Happ Proxy», «INCY VPN» → happ / incy */
export const appKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .split(/[\s\-–—_]+/)[0] ?? '';

export const getAppLogo = (name: string): AppLogo | undefined => LOGOS[appKey(name)];

/**
 * Какие приложения показываем, что бы ни было в конфиге панели (решение владельца
 * 22.10.2026: только Happ и INCY). Платформа без них не показывается.
 */
export const ALLOWED_APPS = ['happ', 'incy'];

export const isAllowedApp = (name: string) => ALLOWED_APPS.includes(appKey(name));

/** Рекомендуем INCY; где его нет — Happ (featured в панели). */
export const isDefaultApp = (name: string) => appKey(name) === 'incy';
