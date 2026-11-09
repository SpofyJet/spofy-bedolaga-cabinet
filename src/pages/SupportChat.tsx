import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/spofy/ui';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  PiArrowUpBold,
  PiCaretLeftBold,
  PiPlusBold,
  PiImageSquareDuotone,
  PiLockKeyDuotone,
  PiWarningCircleDuotone,
  PiXBold,
} from 'react-icons/pi';

import { ticketsApi } from '../api/tickets';
import { infoApi } from '../api/info';
import { ticketNotificationsApi } from '../api/ticketNotifications';
import { MessageMediaGrid } from '../components/tickets/MessageMediaGrid';
import { useAuthStore } from '../store/auth';
import { useBranding } from '@/hooks/useBranding';
import { useHaptic } from '@/platform';
import { SUPPORT_CHAT_KEY, SUPPORT_LIST_KEY, SUPPORT_UNREAD_KEY } from '@/hooks/useSupportUnread';
import { useFitViewportHeight } from '@/hooks/useFitViewportHeight';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '../utils/api-error';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMIT_KEYS } from '../utils/rateLimit';
import { isOpenTicketConflict } from '../utils/ticketErrors';
import { linkifyText } from '../utils/linkify';
import { uiLocale } from '@/utils/uiLocale';
import {
  SUPPORT_MAX_ATTACHMENTS,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_MEDIA_TYPES,
  buildTicketTitle,
  dayKey,
  isTicketOpen,
  toMediaParams,
  type ReadyAttachment,
} from '../utils/supportChat';
import type { TicketDetail, TicketMessage } from '../types';

import './support.css';

interface Attachment {
  id: string;
  file: File;
  preview: string;
  mediaType: 'photo' | 'video';
  uploading: boolean;
  fileId?: string;
  failed?: boolean;
}

const detailKey = (id: number | undefined) => [...SUPPORT_CHAT_KEY, 'ticket', id] as const;

const newId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/**
 * Одно обращение — один чат (/support/:id), как тикет в боте. /support/new —
 * новое обращение: первое сообщение создаёт тикет и чат переезжает на его адрес.
 * Закрытое обращение только читается; продолжить — новым обращением.
 */
export default function SupportChat() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { logoUrl, hasCustomLogo, logoLetter } = useBranding();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { ticketId: idParam } = useParams();
  const isNew = idParam === 'new';
  const ticketIdNum = isNew ? undefined : Number(idParam);
  const badId = !isNew && !(Number.isInteger(ticketIdNum) && (ticketIdNum ?? 0) > 0);

  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const blobUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = blobUrls.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  const { data: supportConfig, isLoading: configLoading } = useQuery({
    queryKey: ['support-config'],
    queryFn: infoApi.getSupportConfig,
  });
  const chatEnabled = supportConfig?.tickets_enabled === true;

  // Новое обращение: если открытое уже есть (бот держит одно), пишем в него.
  const { data: ticketsPage, isLoading: listLoading } = useQuery({
    queryKey: SUPPORT_LIST_KEY,
    queryFn: () => ticketsApi.getTickets({ page: 1, per_page: 20 }),
    enabled: chatEnabled && isNew,
  });
  const openElsewhere = isNew ? ticketsPage?.items.find(isTicketOpen) : undefined;

  const {
    data: ticket,
    isLoading: detailLoading,
    isError: detailError,
  } = useQuery({
    queryKey: detailKey(ticketIdNum),
    queryFn: () => ticketsApi.getTicket(Number(idParam)),
    enabled: chatEnabled && ticketIdNum != null && !badId,
    retry: false,
    // Ответ оператора приходит по WebSocket (useSupportUnread инвалидирует
    // SUPPORT_CHAT_KEY); опрос — страховка, если сокет отвалился.
    refetchInterval: (query) =>
      query.state.data && isTicketOpen(query.state.data) ? 20_000 : false,
  });
  const ticketIsOpen = ticket ? isTicketOpen(ticket) : false;

  // Человек в чате — уведомления по этой переписке прочитаны.
  const adminMessages = ticket?.messages.filter((m) => m.is_from_admin).length ?? 0;
  useEffect(() => {
    if (!ticket?.id || adminMessages === 0) return;
    ticketNotificationsApi
      .markTicketAsRead(ticket.id)
      .then(() => queryClient.invalidateQueries({ queryKey: SUPPORT_UNREAD_KEY }))
      .catch(() => {});
  }, [ticket?.id, adminMessages, queryClient]);

  // ---------- Вложения ----------

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const free = SUPPORT_MAX_ATTACHMENTS - attachments.length;
    const picked = Array.from(files);
    if (picked.length > free) {
      setError(t('support.chat.tooManyFiles', { count: SUPPORT_MAX_ATTACHMENTS }));
    }
    const queue: Attachment[] = [];
    for (const file of picked.slice(0, Math.max(0, free))) {
      const mediaType = SUPPORT_MEDIA_TYPES[file.type];
      if (!mediaType) {
        setError(t('support.chat.badFile'));
        continue;
      }
      if (file.size > SUPPORT_MAX_FILE_BYTES) {
        setError(t('support.fileTooLarge'));
        continue;
      }
      const preview = mediaType === 'photo' ? URL.createObjectURL(file) : '';
      if (preview) blobUrls.current.add(preview);
      queue.push({ id: newId(), file, preview, mediaType, uploading: true });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (queue.length === 0) return;
    setAttachments((prev) => [...prev, ...queue]);
    await Promise.all(
      queue.map(async ({ id, file, mediaType }) => {
        try {
          const res = await ticketsApi.uploadMedia(file, mediaType);
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, uploading: false, fileId: res.file_id } : a)),
          );
        } catch {
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, uploading: false, failed: true } : a)),
          );
        }
      }),
    );
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
        blobUrls.current.delete(target.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const uploading = attachments.some((a) => a.uploading);
  const ready: ReadyAttachment[] = attachments
    .filter((a): a is Attachment & { fileId: string } => !!a.fileId)
    .map((a) => ({ mediaType: a.mediaType, fileId: a.fileId }));

  // ---------- Отправка ----------

  const sendMutation = useMutation({
    mutationFn: async ({ text, media }: { text: string; media: ReadyAttachment[] }) => {
      const params = toMediaParams(media);
      if (ticket && ticketIsOpen) {
        await ticketsApi.addMessage(ticket.id, text, params);
        return ticket.id;
      }
      try {
        const created: TicketDetail = await ticketsApi.createTicket(
          buildTicketTitle(text, t('support.chat.ticketTitle')),
          text,
          params,
        );
        return created.id;
      } catch (err) {
        // Обращение открыли в другом месте (бот, второе устройство) — пишем в него.
        if (!isOpenTicketConflict(err)) throw err;
        const fresh = await ticketsApi.getTickets({ page: 1, per_page: 20 });
        const open = fresh.items.find(isTicketOpen);
        if (!open) throw err;
        await ticketsApi.addMessage(open.id, text, params);
        return open.id;
      }
    },
    onSuccess: (id) => {
      for (const a of attachments) {
        if (a.preview) URL.revokeObjectURL(a.preview);
      }
      setAttachments([]);
      // первое сообщение нового обращения: чат переезжает на адрес тикета
      if (id !== ticket?.id) navigate(`/support/${id}`, { replace: true });
    },
    onError: (err: unknown, vars) => {
      // Текст возвращаем в поле — ничего не теряется.
      setDraft((current) => current || vars.text);
      setError(getApiErrorMessage(err, t('support.chat.sendFailed')));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: SUPPORT_CHAT_KEY });
      setPendingText(null);
    },
  });

  // Закрыть обращение: первое нажатие спрашивает «Точно?», второе закрывает.
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => {
    if (!confirmClose) return;
    const timer = setTimeout(() => setConfirmClose(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmClose]);
  const closeMutation = useMutation({
    mutationFn: (id: number) => ticketsApi.closeTicket(id),
    onSuccess: (closed) => {
      haptic.notification('success');
      queryClient.setQueryData(detailKey(closed.id), closed);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t('support.chat.closeFailed')));
    },
    onSettled: async () => {
      setConfirmClose(false);
      await queryClient.invalidateQueries({ queryKey: SUPPORT_CHAT_KEY });
    },
  });
  const onCloseTicket = () => {
    if (!ticket || closeMutation.isPending) return;
    if (!confirmClose) {
      haptic.impact('light');
      setConfirmClose(true);
      return;
    }
    closeMutation.mutate(ticket.id);
  };

  const canSend =
    (draft.trim().length > 0 || ready.length > 0) && !uploading && !sendMutation.isPending;

  const send = () => {
    if (!canSend) return;
    if (!checkRateLimit(RATE_LIMIT_KEYS.TICKET_REPLY, 5, 30_000)) {
      setError(
        t('support.tooManyRequests', {
          seconds: getRateLimitResetTime(RATE_LIMIT_KEYS.TICKET_REPLY),
        }),
      );
      return;
    }
    const text = draft.trim();
    setError(null);
    setDraft('');
    setPendingText(text || null);
    sendMutation.mutate({ text, media: ready });
    inputRef.current?.focus();
  };

  // ---------- Автовысота поля и прокрутка ----------

  // biome-ignore lint/correctness/useExhaustiveDependencies: draft — намеренный повод перезапуска
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  const messages = ticket?.messages ?? [];
  const lastId = messages[messages.length - 1]?.id;
  // Прокручивается только лента: страница чата ровно по высоте экрана.
  const pageRef = useFitViewportHeight<HTMLDivElement>();
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollToEnd = useCallback((smooth: boolean) => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo?.({ top: feed.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  const firstScroll = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastId, pendingText — намеренный повод перезапуска
  useEffect(() => {
    if (configLoading || detailLoading) return;
    scrollToEnd(!firstScroll.current);
    firstScroll.current = false;
  }, [lastId, pendingText, configLoading, detailLoading, scrollToEnd]);

  // ---------- Рендер ----------

  const loading =
    configLoading || (isNew && chatEnabled && listLoading) || (!isNew && detailLoading);
  const timeFmt = new Intl.DateTimeFormat(uiLocale(), { hour: '2-digit', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat(uiLocale(), { day: 'numeric', month: 'long' });
  const todayKey = dayKey(new Date().toISOString());
  const replyBlocked = ticketIsOpen && ticket?.is_reply_blocked === true;

  const goBack = () => {
    haptic.impact('light');
    navigate('/support');
  };
  const statusText = isNew
    ? t('support.chat.subtitle')
    : ticket && !ticketIsOpen
      ? t('support.chat.statusClosed')
      : ticket?.status === 'answered'
        ? t('support.chat.statusAnswered')
        : t('support.chat.statusWaiting');

  const header = (
    <header className="support-head">
      <button
        type="button"
        onClick={goBack}
        aria-label={t('common.back', 'Назад')}
        className="support-head-back"
      >
        <PiCaretLeftBold className="h-[18px] w-[18px]" />
      </button>
      <span className="support-head-avatar" aria-hidden>
        {hasCustomLogo && logoUrl ? <img src={logoUrl} alt="" /> : logoLetter.toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold tracking-tight text-dark-50">
          {isNew
            ? t('support.chat.newTicket')
            : ticket
              ? ticket.title
              : t('support.chat.ticketNumber', { id: ticketIdNum })}
        </span>
        {/* Статус — одной строкой под заголовком: на узком экране не переносится. */}
        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-dark-400">
          {(isNew || ticketIsOpen) && <span className="support-head-online" aria-hidden />}
          <span className="min-w-0 truncate">
            {!isNew && ticket && (
              <span className="text-dark-500">
                {t('support.chat.ticketNumber', { id: ticket.id })} ·{' '}
              </span>
            )}
            {statusText}
          </span>
        </span>
      </span>
      {!isNew && ticket && ticketIsOpen && (
        <button
          type="button"
          onClick={onCloseTicket}
          disabled={closeMutation.isPending}
          className={`support-head-close${confirmClose ? ' support-head-close-confirm' : ''}`}
        >
          {confirmClose ? t('support.chat.closeConfirm') : t('support.chat.close')}
        </button>
      )}
    </header>
  );

  // Чат выключен, адрес не тот или обращения нет — список обращений всё объяснит.
  if (!configLoading && (!chatEnabled || badId || detailError))
    return <Navigate to="/support" replace />;
  if (openElsewhere) return <Navigate to={`/support/${openElsewhere.id}`} replace />;

  if (loading) {
    return (
      <div className="support-page" ref={pageRef}>
        {header}
        <div className="space-y-3 pt-4">
          <Skeleton className="h-14 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          <Skeleton className="h-16 w-4/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  const renderMessage = (msg: TicketMessage, prev: TicketMessage | undefined) => {
    const k = dayKey(msg.created_at);
    const showDay = !prev || dayKey(prev.created_at) !== k;
    const sameAuthor = prev && prev.is_from_admin === msg.is_from_admin && !showDay;
    return (
      <Fragment key={msg.id}>
        {showDay && (
          <div className="support-day">
            {k === todayKey ? t('support.chat.today') : dayFmt.format(new Date(msg.created_at))}
          </div>
        )}
        <div
          className={`support-msg ${msg.is_from_admin ? 'support-msg-in' : 'support-msg-out'}${
            sameAuthor ? ' support-msg-cont' : ''
          }`}
        >
          {msg.is_from_admin && !sameAuthor && (
            <span className="support-msg-author">{t('support.supportTeam')}</span>
          )}
          <div className="support-bubble">
            <MessageMediaGrid message={msg} translateError={t('support.imageLoadFailed')} />
            {msg.message_text && (
              <span
                className="support-bubble-text whitespace-pre-wrap break-words"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML проходит через DOMPurify
                dangerouslySetInnerHTML={{ __html: linkifyText(msg.message_text) }}
              />
            )}
            <span className="support-bubble-time">{timeFmt.format(new Date(msg.created_at))}</span>
          </div>
        </div>
      </Fragment>
    );
  };

  return (
    <div className="support-page" ref={pageRef}>
      {header}

      <div className="support-feed" ref={feedRef} aria-live="polite">
        <div className="support-note">
          <PiLockKeyDuotone className="h-5 w-5 shrink-0" aria-hidden />
          <p>{t('support.chat.safety')}</p>
        </div>

        {/* приветствие — только у нового обращения: в старом оно стояло бы до первого сообщения */}
        {isNew && (
          <div className="support-msg support-msg-in">
            <span className="support-msg-author">{t('support.supportTeam')}</span>
            <div className="support-bubble">
              <span className="support-bubble-text">
                {user?.first_name
                  ? t('support.chat.welcomeNamed', { name: user.first_name })
                  : t('support.chat.welcome')}
              </span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => renderMessage(msg, messages[i - 1]))}

        {ticket && !ticketIsOpen && (
          <div className="support-closed">{t('support.chat.closed')}</div>
        )}

        {pendingText && (
          <div className="support-msg support-msg-out support-msg-pending">
            <div className="support-bubble">
              <span className="support-bubble-text">{pendingText}</span>
              <span className="support-bubble-time">{t('support.chat.sending')}</span>
            </div>
          </div>
        )}
      </div>

      {ticket && !ticketIsOpen ? (
        <div className="support-composer">
          <Button className="w-full" onClick={() => navigate('/support/new')}>
            <PiPlusBold className="h-4 w-4" aria-hidden />
            {t('support.chat.newTicket')}
          </Button>
        </div>
      ) : replyBlocked ? (
        <div className="support-composer">
          <p className="support-blocked">{t('support.repliesDisabled')}</p>
        </div>
      ) : (
        <div className="support-composer">
          {error && (
            <p className="support-error" role="alert">
              <PiWarningCircleDuotone className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {attachments.length > 0 && (
            <div className="support-attachments">
              {attachments.map((a) => (
                <div key={a.id} className={`support-att${a.failed ? ' support-att-failed' : ''}`}>
                  {a.preview ? (
                    <img src={a.preview} alt="" />
                  ) : (
                    <span className="support-att-video">{a.file.name.split('.').pop()}</span>
                  )}
                  {a.uploading && <span className="support-att-spinner" aria-hidden />}
                  {a.failed && (
                    <span className="support-att-flag" title={t('support.uploadFailed')}>
                      !
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="support-att-remove"
                    aria-label={t('common.delete', 'Удалить')}
                  >
                    <PiXBold className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            className="support-composer-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept={Object.keys(SUPPORT_MEDIA_TYPES).join(',')}
              onChange={(e) => addFiles(e.target.files)}
            />
            <button
              type="button"
              className="support-attach"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t('support.attachMedia')}
              title={t('support.attachMedia')}
            >
              <PiImageSquareDuotone className="h-[22px] w-[22px]" />
            </button>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // На телефоне Enter — перенос строки, отправка кнопкой.
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  window.matchMedia('(hover: hover)').matches
                ) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder={
                ticket && ticketIsOpen
                  ? t('support.chat.placeholder')
                  : t('support.chat.placeholderNew')
              }
              aria-label={t('support.chat.placeholder')}
              className="support-input"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="support-send"
              aria-label={t('support.chat.send')}
            >
              <PiArrowUpBold className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
