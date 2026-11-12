import { describe, expect, it } from 'vitest';
import { isMobileNavScreen, mobileNavItems } from './mobileNavRoutes';

/**
 * Нижняя панель на телефоне: Главная · Подписка · [Друзья|Колесо] · Поддержка ·
 * Профиль (подключение — кнопкой на главной). «Подписка» — тот же раздел, что в
 * навигации на ПК: 12.11 владелец не нашёл его в Mini App на телефоне. Панель
 * живёт только на экранах своих кнопок: на вложенных страницах и в админке её
 * нет, и место под неё не резервируется. Остальные разделы (баланс, инфо,
 * подарки, конкурсы) — на главной и в меню шапки (☰).
 */
describe('mobileNavItems', () => {
  it('без флагов — четыре базовых экрана, «Подписка» сразу после главной', () => {
    expect(mobileNavItems({}).map((item) => item.path)).toEqual([
      '/',
      '/subscriptions',
      '/support',
      '/profile',
    ]);
  });

  it('слот у рефералки, даже когда колесо включено', () => {
    const paths = mobileNavItems({ wheelEnabled: true, referralEnabled: true }).map(
      (item) => item.path,
    );
    expect(paths).toEqual(['/', '/subscriptions', '/referral', '/support', '/profile']);
  });

  it('колесо получает слот, только когда рефералка выключена', () => {
    const paths = mobileNavItems({ wheelEnabled: true }).map((item) => item.path);
    expect(paths).toEqual(['/', '/subscriptions', '/wheel', '/support', '/profile']);
  });

  it('рефералка получает слот, когда колесо выключено', () => {
    const paths = mobileNavItems({ referralEnabled: true }).map((item) => item.path);
    expect(paths).toEqual(['/', '/subscriptions', '/referral', '/support', '/profile']);
  });

  it('вкладок не больше пяти при любых флагах', () => {
    for (const wheelEnabled of [false, true]) {
      for (const referralEnabled of [false, true]) {
        for (const lite of [false, true]) {
          expect(
            mobileNavItems({ wheelEnabled, referralEnabled, lite }).length,
          ).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('простой вид — без «Подписки»: главный экран там и есть экран подписки', () => {
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
      'subscription',
      'wheel',
      'support',
      'profile',
    ]);
  });
});

describe('isMobileNavScreen', () => {
  const items = mobileNavItems({ wheelEnabled: true });

  it('главная и экраны кнопок — да', () => {
    for (const path of ['/', '/subscriptions', '/wheel', '/support', '/profile']) {
      expect(isMobileNavScreen(path, items), path).toBe(true);
    }
  });

  it('хвостовой слеш не мешает', () => {
    expect(isMobileNavScreen('/support/', items)).toBe(true);
    expect(isMobileNavScreen('/subscriptions/12/', items)).toBe(true);
  });

  it('карточка подписки — экран кнопки «Подписка»: список с одной подпиской открывает её сам', () => {
    expect(isMobileNavScreen('/subscriptions/12', items)).toBe(true);
    expect(isMobileNavScreen('/subscriptions/4821', items)).toBe(true);
  });

  it('продление, покупка и чужие пути под /subscriptions — нет', () => {
    for (const path of [
      '/subscriptions/12/renew',
      '/subscriptions/abc',
      '/subscriptions/12/extra',
      '/subscription/purchase',
      '/subscription',
    ]) {
      expect(isMobileNavScreen(path, items), path).toBe(false);
    }
  });

  it('в простом виде карточка подписки — обычная вложенная страница', () => {
    const lite = mobileNavItems({ lite: true });
    expect(isMobileNavScreen('/subscriptions', lite)).toBe(false);
    expect(isMobileNavScreen('/subscriptions/12', lite)).toBe(false);
  });

  it('админка и вложенные страницы — нет', () => {
    for (const path of [
      '/admin',
      '/admin/reachability',
      '/balance',
      '/balance/top-up',
      '/connection',
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
