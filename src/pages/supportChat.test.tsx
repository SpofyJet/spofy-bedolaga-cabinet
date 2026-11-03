// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Support from './Support';
import { buildTicketTitle, pickChatTicket, toMediaParams } from '../utils/supportChat';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  create: vi.fn(),
  reply: vi.fn(),
  markRead: vi.fn(),
}));

const openTicket = {
  id: 1,
  title: 'Не подключается',
  status: 'answered',
  priority: 'normal',
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T12:00:00Z',
  closed_at: null,
  is_reply_blocked: false,
  messages: [
    {
      id: 10,
      message_text: 'Смотрите https://example.com',
      is_from_admin: true,
      has_media: false,
      media_type: null,
      media_file_id: null,
      media_caption: null,
      created_at: '2026-11-01T12:00:00Z',
    },
  ],
};
const closedTicket = { ...openTicket, id: 2, status: 'closed', messages: [] };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../api/info', () => ({
  infoApi: { getSupportConfig: async () => ({ tickets_enabled: true, support_type: 'tickets' }) },
}));
vi.mock('../api/ticketNotifications', () => ({
  ticketNotificationsApi: { markTicketAsRead: api.markRead },
}));
vi.mock('@/hooks/useSupportUnread', () => ({
  SUPPORT_CHAT_KEY: ['support-chat'],
  SUPPORT_UNREAD_KEY: ['ticket-notifications-count'],
}));
vi.mock('@/hooks/useBranding', () => ({
  useBranding: () => ({ appName: 'Spofy', logoUrl: null, hasCustomLogo: false, logoLetter: 'S' }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({ openLink: vi.fn(), openTelegramLink: vi.fn() }),
}));
vi.mock('../api/tickets', () => ({
  ticketsApi: {
    getTickets: api.list,
    getTicket: api.get,
    uploadMedia: api.upload,
    createTicket: api.create,
    addMessage: api.reply,
    getMediaUrl: () => 'blob:media',
  },
}));

const renderChat = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Support />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  api.upload.mockImplementation(async (file: File) => ({ file_id: `id_${file.name}` }));
  api.create.mockResolvedValue({ ...openTicket, id: 5 });
  api.reply.mockResolvedValue({});
  api.markRead.mockResolvedValue({ success: true, marked_count: 1 });
  api.get.mockImplementation(async (id: number) =>
    id === closedTicket.id ? closedTicket : openTicket,
  );
});
afterEach(cleanup);

const media = {
  media_type: 'video',
  media_file_id: 'id_clip.mp4',
  media_items: [
    { type: 'video', file_id: 'id_clip.mp4' },
    { type: 'photo', file_id: 'id_shot.png' },
  ],
};

async function attachAndSend(container: HTMLElement, text: string) {
  const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
  expect(input.accept).toContain('video/mp4');
  fireEvent.change(input, {
    target: {
      files: [
        new File(['v'], 'clip.mp4', { type: 'video/mp4' }),
        new File(['p'], 'shot.png', { type: 'image/png' }),
      ],
    },
  });
  await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
  const submit = container.querySelector<HTMLButtonElement>('button[type=submit]')!;
  await waitFor(() => expect(submit.disabled).toBe(false));
  fireEvent.submit(container.querySelector('form')!);
}

describe('Support chat', () => {
  it('replies into the open conversation with mixed media', async () => {
    api.list.mockResolvedValue({ items: [openTicket] });
    const { container } = renderChat();
    // Ссылка оператора — настоящая <a>, а не HTML-текст.
    const link = await screen.findByRole('link', { name: 'https://example.com' });
    expect(link.getAttribute('href')).toBe('https://example.com');
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith(1));

    await attachAndSend(container, 'Всё ещё не работает');
    await waitFor(() => expect(api.reply).toHaveBeenCalledWith(1, 'Всё ещё не работает', media));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('starts a new conversation after the last one was closed', async () => {
    api.list.mockResolvedValue({ items: [closedTicket] });
    const { container } = renderChat();
    await screen.findByText('support.chat.closed');

    await attachAndSend(container, 'Нужна помощь с оплатой');
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        'Нужна помощь с оплатой',
        'Нужна помощь с оплатой',
        media,
      ),
    );
  });

  it('falls back to the open ticket when the backend answers 409', async () => {
    api.list.mockResolvedValueOnce({ items: [] }).mockResolvedValue({ items: [openTicket] });
    api.create.mockRejectedValue(
      new AxiosError('conflict', '409', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderChat();
    const box = await screen.findByRole('textbox');
    fireEvent.change(box, { target: { value: 'Привет' } });
    fireEvent.submit(box.closest('form')!);
    await waitFor(() => expect(api.reply).toHaveBeenCalledWith(1, 'Привет', undefined));
  });
});

describe('supportChat utils', () => {
  it('prefers an open ticket, otherwise the most recent one', () => {
    const a = { id: 1, status: 'closed', updated_at: '2026-11-02T00:00:00Z' };
    const b = { id: 2, status: 'pending', updated_at: '2026-10-01T00:00:00Z' };
    expect(pickChatTicket([a, b])?.id).toBe(2);
    expect(pickChatTicket([a, { ...b, status: 'closed' }])?.id).toBe(1);
    expect(pickChatTicket([])).toBeNull();
  });

  it('builds a valid ticket title', () => {
    expect(buildTicketTitle('', 'Фолбэк')).toBe('Фолбэк');
    expect(buildTicketTitle('ок', 'Фолбэк')).toBe('Фолбэк');
    expect(buildTicketTitle('Первая строка\nвторая', 'x')).toBe('Первая строка');
    expect(buildTicketTitle('a'.repeat(100), 'x')).toHaveLength(58);
  });

  it('maps attachments to media params', () => {
    expect(toMediaParams([])).toBeUndefined();
    expect(toMediaParams([{ mediaType: 'photo', fileId: 'f' }])).toEqual({
      media_type: 'photo',
      media_file_id: 'f',
      media_items: [{ type: 'photo', file_id: 'f' }],
    });
  });
});
