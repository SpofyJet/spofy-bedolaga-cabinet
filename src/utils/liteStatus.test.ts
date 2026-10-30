import { describe, expect, it } from 'vitest';
import { liteStatus, RENEW_PROMPT_DAYS, type LiteStatusInput } from './liteStatus';

/**
 * Кнопка на простом экране одна, поэтому цена ошибки в порядке проверок —
 * человек видит не то действие, которое ему сейчас нужно. Состояния умеют
 * совмещаться: пробная подписка бывает и заканчивающейся, и упёршейся в
 * трафик одновременно. Тесты фиксируют, кто кого перебивает.
 */

const active: LiteStatusInput = {
  status: 'active',
  is_expired: false,
  is_limited: false,
  is_trial: false,
  days_left: 20,
  end_date: '2026-10-15T00:00:00Z',
};

describe('liteStatus', () => {
  it('без подписки зовёт покупать', () => {
    expect(liteStatus(null)).toEqual({ key: 'none', action: 'buy', date: null });
    expect(liteStatus(undefined).key).toBe('none');
  });

  it('живая подписка зовёт подключиться и показывает дату', () => {
    expect(liteStatus(active)).toEqual({
      key: 'active',
      action: 'connect',
      date: '2026-10-15T00:00:00Z',
    });
  });

  it('пробная отличается от обычной, но действие то же', () => {
    const status = liteStatus({ ...active, is_trial: true });
    expect(status.key).toBe('trial');
    expect(status.action).toBe('connect');
  });

  it('на исходе сохраняет подключение главным действием', () => {
    expect(liteStatus({ ...active, days_left: RENEW_PROMPT_DAYS }).key).toBe('expiring');
    expect(liteStatus({ ...active, days_left: RENEW_PROMPT_DAYS }).action).toBe('connect');
    expect(liteStatus({ ...active, days_left: RENEW_PROMPT_DAYS + 1 }).key).toBe('active');
  });

  it('пробный период зовёт подключиться, даже когда до конца день-три', () => {
    // Триал длится день-три: раньше «заканчивается» срабатывало сразу после
    // активации и вело в «Продлить» — на экран «Нет вариантов продления».
    const status = liteStatus({ ...active, is_trial: true, days_left: 1 });
    expect(status.key).toBe('trial');
    expect(status.action).toBe('connect');
  });

  it('истёкшая перебивает всё остальное', () => {
    const status = liteStatus({
      ...active,
      is_expired: true,
      is_trial: true,
      is_limited: true,
      days_left: 0,
    });
    expect(status.key).toBe('expired');
    // Пробный период не продлевается — после него покупают тариф.
    expect(status.action).toBe('buy');
  });

  it('истёкшую платную зовёт продлить', () => {
    const status = liteStatus({ ...active, is_expired: true, days_left: 0 });
    expect(status.key).toBe('expired');
    expect(status.action).toBe('renew');
  });

  it.each([
    ['expired', { is_expired: true }],
    ['disabled', { status: 'disabled' }],
  ])('неактивная подписка %s со ссылкой сохраняет вход на саб-страницу', (_status, override) => {
    const status = liteStatus({
      ...active,
      ...override,
      subscription_url: 'https://example.invalid/sub/7',
    });
    expect(status.key).toBe('expired');
    expect(status.action).toBe('connect');
  });

  it('crypto-link тоже сохраняет вход после окончания доступа', () => {
    const status = liteStatus({
      ...active,
      is_expired: true,
      subscription_crypto_link: 'happ://crypt/example',
    });
    expect(status.action).toBe('connect');
  });

  it.each([
    ['обычной', false, 'renew'],
    ['пробной', true, 'buy'],
  ] as const)(
    'истёкшая %s подписка без ссылки не получает мёртвое подключение',
    (_name, is_trial, action) => {
      expect(
        liteStatus({ ...active, is_expired: true, is_trial, subscription_url: null }).action,
      ).toBe(action);
    },
  );

  it('истёкшая старая подписка без ссылки ведёт к выбору тарифа', () => {
    expect(
      liteStatus({ ...active, is_expired: true, requires_tariff_selection: true }).action,
    ).toBe('chooseTariff');
  });

  it('выключенную считает истёкшей', () => {
    expect(liteStatus({ ...active, status: 'disabled' }).key).toBe('expired');
  });

  it('кончившийся трафик не предлагает продление — оно его не чинит', () => {
    const status = liteStatus({ ...active, is_limited: true });
    expect(status.key).toBe('limited');
    expect(status.action).toBe('manage');
    expect(status.date).toBeNull();
  });

  it('пауза важнее кончившегося трафика: сначала надо снять паузу', () => {
    const status = liteStatus({ ...active, is_daily_paused: true, is_limited: true });
    expect(status.key).toBe('paused');
    expect(status.action).toBe('manage');
  });

  it('живая старая подписка сохраняет подключение главным действием', () => {
    const status = liteStatus({ ...active, requires_tariff_selection: true, days_left: 1 });
    expect(status.key).toBe('legacy');
    expect(status.action).toBe('connect');
  });

  it('истёкшая старая подписка всё же продлевается через выбор тарифа', () => {
    // is_expired проверяется раньше, и это осознанно: «закончилась» — главное,
    // что надо сказать. Кнопка «Продлить» у такой подписки ведёт в тот же
    // выбор тарифа, поэтому тупика не возникает.
    expect(liteStatus({ ...active, requires_tariff_selection: true, is_expired: true }).key).toBe(
      'expired',
    );
  });

  it('без days_left не выдумывает исход', () => {
    const { days_left: _omitted, ...withoutDays } = active;
    expect(liteStatus(withoutDays).key).toBe('active');
  });
});
