/**
 * Экраны нижней панели на телефоне. Панель живёт только там, куда ведут её
 * кнопки: на вложенных страницах и в админке её нет, и место под неё не
 * резервируется (AppShell ставит data-mobile-nav="off", см. globals.css).
 */
export type MobileNavKey =
  | 'dashboard'
  | 'subscription'
  | 'wheel'
  | 'referral'
  | 'support'
  | 'profile';

export interface MobileNavItem {
  /** Ключ пункта: хвост ключа перевода `nav.*` и ключ иконки в панели. */
  readonly key: MobileNavKey;
  readonly path: string;
}

export interface MobileNavFlags {
  readonly wheelEnabled?: boolean;
  readonly referralEnabled?: boolean;
  /**
   * Простой вид: главный экран сам и есть экран подписки, поэтому отдельная
   * кнопка «Подписка» ведёт человека туда, где он уже стоит. Ровно это
   * дублирование «Главного» и «Подписки» и заставило завести простой вид.
   */
  readonly lite?: boolean;
}

const DASHBOARD: MobileNavItem = { key: 'dashboard', path: '/' };
const SUBSCRIPTION: MobileNavItem = { key: 'subscription', path: '/subscriptions' };
const SUPPORT: MobileNavItem = { key: 'support', path: '/support' };
const PROFILE: MobileNavItem = { key: 'profile', path: '/profile' };
const WHEEL: MobileNavItem = { key: 'wheel', path: '/wheel' };
const REFERRAL: MobileNavItem = { key: 'referral', path: '/referral' };

/**
 * Панель — до пяти вкладок:
 * Главная · Подписка · [Друзья|Колесо] · Поддержка · Профиль. «Подключить» —
 * кнопка на главной, отдельная кнопка в панели её только дублировала.
 * «Подписка» — тот же раздел, что в навигации на ПК: без вкладки путь к тарифу,
 * устройствам и настройкам подписки на телефоне шёл только через строку на
 * главной, а у пробной и истекающей подписки этой строки нет вовсе.
 * Баланс живёт на главной, остальное — в меню шапки (☰): операторский состав
 * флагов (конкурсы, опросы, подарки, инфо) туда и так собран, дублировать его
 * вторым рядом кнопок незачем. Слот у «Друзей»; колесо получает его, только
 * если рефералка выключена (иначе — баннер и меню шапки).
 */
function slotItems({ wheelEnabled, referralEnabled }: MobileNavFlags): readonly MobileNavItem[] {
  // Spofy: слот за «Друзьями»; колесо — баннер на главной и пункт меню шапки.
  if (referralEnabled) return [REFERRAL];
  if (wheelEnabled) return [WHEEL];
  return [];
}

export function mobileNavItems(flags: MobileNavFlags): readonly MobileNavItem[] {
  const head = flags.lite ? [DASHBOARD] : [DASHBOARD, SUBSCRIPTION];
  return [...head, ...slotItems(flags), SUPPORT, PROFILE];
}

function withoutTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Экраны, куда кнопка панели приводит не напрямую.
 *
 * «Подписка» ведёт на список, а список с единственной подпиской сам открывает её
 * карточку (Subscriptions.tsx). Для человека это и есть экран кнопки: он нажал
 * «Подписка» и оказался здесь — панель пропадать не должна. Продление и покупка
 * сюда не попадают: туда уходят уже изнутри карточки.
 */
const NAV_SCREEN_PATTERNS: readonly RegExp[] = [/^\/subscriptions\/\d+$/];

/** Экран кнопки: сам путь пункта или то, во что он разворачивается. */
export function isMobileNavScreen(pathname: string, items: readonly MobileNavItem[]): boolean {
  const path = withoutTrailingSlash(pathname);
  if (items.some((item) => item.path === path)) return true;

  // Карточка подписки — экран кнопки, только пока такая кнопка есть. В простом
  // виде её нет, и карточка остаётся обычной вложенной страницей: панель на ней
  // показывалась бы без пункта, который туда ведёт.
  if (!items.some((item) => item.path === SUBSCRIPTION.path)) return false;
  return NAV_SCREEN_PATTERNS.some((pattern) => pattern.test(path));
}
