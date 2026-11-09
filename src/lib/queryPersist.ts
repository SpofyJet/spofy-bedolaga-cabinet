import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { safeLocal } from '../utils/safeStorage';

const STORAGE_KEY = 'cabinet-query-cache-v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_BYTES = 300_000;
const SAVE_DELAY_MS = 1000;

// Только то, что показываем сразу при открытии. Цены и способы оплаты сюда не входят:
// по устаревшим значениям человек мог бы принять решение о покупке.
const PERSISTED_ROOTS = new Set([
  'balance',
  'devices',
  'pending-gifts',
  'referral-info',
  'reminders',
  'subscription',
  'subscriptions-list',
  'trial-info',
  'user-avatar',
  'wheel-config',
]);

interface StoredCache {
  userId: number;
  savedAt: number;
  state: DehydratedState;
}

function currentUserId(): number | null {
  return useAuthStore.getState().user?.id ?? null;
}

function restore(queryClient: QueryClient): void {
  const userId = currentUserId();
  const raw = safeLocal.getItem(STORAGE_KEY);
  if (!raw || userId === null) return;
  try {
    const stored = JSON.parse(raw) as StoredCache;
    if (stored.userId === userId && Date.now() - stored.savedAt < MAX_AGE_MS) {
      hydrate(queryClient, stored.state);
      return;
    }
  } catch {
    // Повреждённая запись бесполезна: удаляем её ниже.
  }
  safeLocal.removeItem(STORAGE_KEY);
}

function save(queryClient: QueryClient): void {
  const userId = currentUserId();
  if (userId === null) return;
  const state = dehydrate(queryClient, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && PERSISTED_ROOTS.has(String(query.queryKey[0])),
  });
  const payload = JSON.stringify({ userId, savedAt: Date.now(), state } satisfies StoredCache);
  if (payload.length <= MAX_BYTES) safeLocal.setItem(STORAGE_KEY, payload);
}

/**
 * Показывает при открытии данные прошлого визита, пока React Query тихо их обновляет.
 * Вызывать до первого рендера.
 */
export function persistQueryCache(queryClient: QueryClient): void {
  restore(queryClient);

  let timer: ReturnType<typeof setTimeout> | undefined;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (!PERSISTED_ROOTS.has(String(event.query.queryKey[0]))) return;
    clearTimeout(timer);
    timer = setTimeout(() => save(queryClient), SAVE_DELAY_MS);
  });

  // Выход или смена аккаунта: чужие данные не должны всплыть при следующем открытии.
  useAuthStore.subscribe((state, previous) => {
    if (previous.user?.id !== undefined && state.user?.id !== previous.user.id) {
      clearTimeout(timer);
      safeLocal.removeItem(STORAGE_KEY);
    }
  });
}
