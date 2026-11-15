import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Структурные проверки страницы «Баланс»: ключи переводов, которыми она пользуется,
// есть во всех языках (пустой ключ в UI выглядит как сырая строка «balance.renew.title»).
const LANGS = ['ru', 'en'];
const KEYS = [
  ['balance', 'renew', 'title'],
  ['balance', 'renew', 'untilShort'],
  ['balance', 'renew', 'perMonth'],
  ['balance', 'referralEarned'],
  ['balance', 'methodFast'],
];

describe('страница «Баланс»: переводы', () => {
  for (const lang of LANGS) {
    it(`${lang}: все новые ключи заданы`, () => {
      const data = JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf-8'));
      for (const path of KEYS) {
        const value = path.reduce((node: any, key) => node?.[key], data);
        expect(value, path.join('.')).toBeTruthy();
      }
    });
  }
});
