/**
 * Экраны нижней панели на телефоне. Панель живёт только там, куда ведут её
 * кнопки: на вложенных страницах и в админке её нет, и место под неё не
 * резервируется (AppShell ставит data-mobile-nav="off", см. globals.css).
 */
export type MobileNavKey = 'dashboard' | 'wheel' | 'referral' | 'support' | 'profile';

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
const SUPPORT: MobileNavItem = { key: 'support', path: '/support' };
const PROFILE: MobileNavItem = { key: 'profile', path: '/profile' };
const WHEEL: MobileNavItem = { key: 'wheel', path: '/wheel' };
const REFERRAL: MobileNavItem = { key: 'referral', path: '/referral' };

/**
 * Минимальная панель — до четырёх вкладок:
 * Главная · [Колесо|Друзья] · Поддержка · Профиль. «Подключить» — плитка на
 * главной, отдельная кнопка в панели её только дублировала.
 * Баланс и подписка живут в шапке/на главной, остальное — в меню шапки (☰):
 * операторский состав флагов (конкурсы, опросы, подарки, инфо) туда и так
 * собран, дублировать его вторым рядом кнопок незачем. Колесо — бренд-момент
 * оператора, поэтому занимает слот и вытесняет рефералку в меню шапки.
 */
function slotItems({ wheelEnabled, referralEnabled }: MobileNavFlags): readonly MobileNavItem[] {
  if (wheelEnabled) return [WHEEL];
  if (referralEnabled) return [REFERRAL];
  return [];
}

export function mobileNavItems(flags: MobileNavFlags): readonly MobileNavItem[] {
  return [DASHBOARD, ...slotItems(flags), SUPPORT, PROFILE];
}

function withoutTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Экран кнопки: сам путь пункта. Вложенные страницы панель не сохраняют. */
export function isMobileNavScreen(pathname: string, items: readonly MobileNavItem[]): boolean {
  const path = withoutTrailingSlash(pathname);
  return items.some((item) => item.path === path);
}
