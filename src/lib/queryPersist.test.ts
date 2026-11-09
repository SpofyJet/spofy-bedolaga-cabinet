// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/auth';
import type { User } from '../types';
import { persistQueryCache } from './queryPersist';

const account = (id: number) => ({ id }) as User;

describe('persistQueryCache', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: account(1) });
  });

  it('при смене аккаунта забывает данные прошлого пользователя', () => {
    const client = new QueryClient();
    persistQueryCache(client);
    client.setQueryData(['balance'], { balance_kopeks: 500 });

    useAuthStore.setState({ user: account(2) });

    expect(client.getQueryData(['balance'])).toBeUndefined();
  });
});
