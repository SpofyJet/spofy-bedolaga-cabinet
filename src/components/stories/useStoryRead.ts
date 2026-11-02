import { useCallback, useSyncExternalStore } from 'react';

import { safeLocal } from '@/utils/safeStorage';

const STORAGE_KEY = 'cabinet-stories-read';

function readIds(): string[] {
  try {
    const raw = safeLocal.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function subscribe(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

function snapReadIds() {
  return readIds().join(',');
}

/** Прочитанные серии — единый источник правды в localStorage, кросс-таб синхронизация. */
export function useStoryRead(): { readIds: string[]; isRead: (id: string) => boolean } {
  const snapshot = useSyncExternalStore(subscribe, snapReadIds, () => '');
  const ids = snapshot ? snapshot.split(',') : [];
  return {
    readIds: ids,
    isRead: useCallback((id: string) => ids.includes(id), [ids]),
  };
}

export function markStoryRead(id: string): void {
  const ids = readIds();
  if (ids.includes(id)) return;
  try {
    safeLocal.setItem(STORAGE_KEY, JSON.stringify([...ids, id]));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  } catch {
    // Хранилище заблокировано — бейдж «не прочитано» просто останется.
  }
}
