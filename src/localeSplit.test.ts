import { describe, expect, it } from 'vitest';
import full from './locales/ru.json';
import adminPart from './locales/ru.json?admin';
import userPart from './locales/ru.json?user';

interface Tree {
  [key: string]: Tree;
}

describe('разделение словаря', () => {
  const user = userPart as unknown as Tree;
  const admin = adminPart as unknown as Tree;

  it('обычному пользователю не приезжают строки админки', () => {
    expect(Object.keys(user.admin).sort()).toEqual(['infoPages', 'nav']);
    expect(JSON.stringify(user).length).toBeLessThan(JSON.stringify(full).length / 2);
  });

  it('вместе части дают весь словарь', () => {
    expect({ ...user, admin: admin.admin }).toEqual(full);
  });
});
