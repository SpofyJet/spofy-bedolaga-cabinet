import { describe, expect, it } from 'vitest';
import { isMobileNavScreen, mobileNavItems } from './mobileNavRoutes';

/**
 * Нижняя панель на телефоне — минимальная: Главная · [Колесо|Друзья] ·
 * Подключить (центральная кнопка) · Поддержка · Профиль. Панель живёт только
 * на экранах своих кнопок: на вложенных страницах и в админке её нет, и место
 * под неё не резервируется. Остальные разделы (баланс, подписка, инфо, подарки,
 * конкурсы) собраны в меню шапки (☰) — кабинет не трогали, только панель.
 */
describe('mobileNavItems', () => {
  it('без флагов — три базовых экрана', () => {
    expect(mobileNavItems({}).map((item) => item.path)).toEqual(['/', '/support', '/profile']);
  });

  it('колесо занимает слот перед поддержкой и вытесняет рефералку', () => {
    const paths = mobileNavItems({ wheelEnabled: true, referralEnabled: true }).map(
      (item) => item.path,
    );
    expect(paths).toEqual(['/', '/wheel', '/support', '/profile']);
  });

  it('рефералка получает слот, когда колесо выключено', () => {
    const paths = mobileNavItems({ referralEnabled: true }).map((item) => item.path);
    expect(paths).toEqual(['/', '/referral', '/support', '/profile']);
  });

  it('простой вид сохраняет тот же минимальный набор', () => {
    expect(mobileNavItems({ lite: true }).map((item) => item.path)).toEqual([
      '/',
      '/support',
      '/profile',
    ]);
    expect(mobileNavItems({ lite: true, wheelEnabled: true }).map((item) => item.path)).toEqual([
      '/',
      '/wheel',
      '/support',
      '/profile',
    ]);
  });

  it('ключ пункта совпадает с ключом перевода nav.*', () => {
    expect(mobileNavItems({ wheelEnabled: true }).map((item) => item.key)).toEqual([
      'dashboard',
      'wheel',
      'support',
      'profile',
    ]);
  });
});

describe('isMobileNavScreen', () => {
  const items = mobileNavItems({ wheelEnabled: true });

  it('главная и экраны кнопок — да', () => {
    for (const path of ['/', '/wheel', '/support', '/profile']) {
      expect(isMobileNavScreen(path, items), path).toBe(true);
    }
  });

  it('хвостовой слеш не мешает', () => {
    expect(isMobileNavScreen('/support/', items)).toBe(true);
  });

  it('админка и вложенные страницы — нет', () => {
    for (const path of [
      '/admin',
      '/admin/reachability',
      '/balance',
      '/balance/top-up',
      '/subscriptions',
      '/subscriptions/12',
      '/info',
    ]) {
      expect(isMobileNavScreen(path, items), path).toBe(false);
    }
  });

  it('экран выключенного слота — нет', () => {
    expect(isMobileNavScreen('/referral', items)).toBe(false);
    expect(isMobileNavScreen('/wheel', mobileNavItems({}))).toBe(false);
  });
});
