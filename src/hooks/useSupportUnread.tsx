import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { ticketNotificationsApi } from '@/api/ticketNotifications';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/components/Toast';
import { useWebSocket, type WSMessage } from '@/hooks/useWebSocket';

export const SUPPORT_UNREAD_KEY = ['ticket-notifications-count'] as const;
export const SUPPORT_CHAT_KEY = ['support-chat'] as const;
/** Список обращений (тикетов) пользователя. */
export const SUPPORT_LIST_KEY = [...SUPPORT_CHAT_KEY, 'list'] as const;

/**
 * Непрочитанные ответы поддержки для пользователя — вместо колокольчика в шапке.
 * Ответ оператора по WebSocket: обновляем счётчик и переписку, а если человек
 * не в чате — короткий тост, который открывает чат.
 * Вызывается один раз — в AppShell.
 */
export function useSupportUnread(enabled = true): number {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { showToast } = useToast();
  // в разделе поддержки (список или любое обращение) тосты и бейдж не нужны
  const inChat = location.pathname === '/support' || location.pathname.startsWith('/support/');

  const onMessage = useCallback(
    (message: WSMessage) => {
      if (message.type !== 'ticket.admin_reply') return;
      queryClient.invalidateQueries({ queryKey: SUPPORT_UNREAD_KEY });
      queryClient.invalidateQueries({ queryKey: SUPPORT_CHAT_KEY });
      if (inChat) return;
      showToast({
        type: 'info',
        title: t('support.chat.toastTitle', 'Ответ поддержки'),
        message: message.message || t('support.chat.toastText', 'Откройте чат, чтобы прочитать'),
        onClick: () => navigate(message.ticket_id ? `/support/${message.ticket_id}` : '/support'),
        duration: 8000,
      });
    },
    [queryClient, inChat, showToast, navigate, t],
  );

  useWebSocket({ onMessage: enabled ? onMessage : undefined });

  const { data } = useQuery({
    queryKey: SUPPORT_UNREAD_KEY,
    queryFn: ticketNotificationsApi.getUnreadCount,
    enabled: enabled && isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return inChat ? 0 : (data?.unread_count ?? 0);
}
