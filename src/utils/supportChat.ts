import type { Ticket, TicketMediaItem } from '../types';

/** Что принимает /cabinet/media/upload — то же, что раньше принимала тикет-форма. */
export const SUPPORT_MEDIA_TYPES: Record<string, 'photo' | 'video'> = {
  'image/jpeg': 'photo',
  'image/png': 'photo',
  'image/gif': 'photo',
  'image/webp': 'photo',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
};

export const SUPPORT_MAX_ATTACHMENTS = 10;
export const SUPPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Тикет, в который сейчас идёт переписка: всё, что не закрыто. */
export function isTicketOpen(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status !== 'closed';
}

/**
 * Чат показывает одну переписку: открытое обращение, а если его нет —
 * последнее закрытое (как история, новое сообщение начнёт новое обращение).
 */
export function pickChatTicket<T extends Pick<Ticket, 'id' | 'status' | 'updated_at'>>(
  tickets: T[] | undefined,
): T | null {
  if (!tickets || tickets.length === 0) return null;
  const byRecent = [...tickets].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  return byRecent.find(isTicketOpen) ?? byRecent[0];
}

/**
 * Тема обращения для админки: первая строка сообщения. Бэк требует 3–255
 * символов, поэтому короткое/пустое (только фото) — нейтральная подпись.
 */
export function buildTicketTitle(text: string, fallback: string): string {
  const firstLine = text.trim().split('\n')[0]?.trim() ?? '';
  if (firstLine.length < 3) return fallback;
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine;
}

export interface ReadyAttachment {
  mediaType: 'photo' | 'video';
  fileId: string;
}

/** Параметры медиа для create/addMessage: legacy-поле + полный список. */
export function toMediaParams(ready: ReadyAttachment[]):
  | {
      media_type: string;
      media_file_id: string;
      media_items: TicketMediaItem[];
    }
  | undefined {
  if (ready.length === 0) return undefined;
  return {
    media_type: ready[0].mediaType,
    media_file_id: ready[0].fileId,
    media_items: ready.map((a) => ({ type: a.mediaType, file_id: a.fileId })),
  };
}

/** Ключ дня для разделителей в ленте. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
