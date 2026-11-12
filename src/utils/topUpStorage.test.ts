// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { loadTopUpPendingInfo, saveTopUpPendingInfo } from './topUpStorage';

const base = {
  amount_kopeks: 15900,
  method_id: 'platega',
  method_name: 'СБП',
  payment_id: '16936',
  created_at: Date.now(),
};

beforeEach(() => sessionStorage.clear());

it('keeps the screen the user left to pay from', () => {
  saveTopUpPendingInfo({ ...base, return_to: '/subscriptions/77/renew?period=90' });
  expect(loadTopUpPendingInfo()?.return_to).toBe('/subscriptions/77/renew?period=90');
});

it('has no return path for a plain top-up', () => {
  saveTopUpPendingInfo(base);
  expect(loadTopUpPendingInfo()).toEqual(base);
});

it('ignores a return path that is not a string', () => {
  sessionStorage.setItem('topup_pending_payment', JSON.stringify({ ...base, return_to: 42 }));
  const loaded = loadTopUpPendingInfo();
  expect(loaded).not.toBeNull();
  expect(loaded?.return_to).toBeUndefined();
});
