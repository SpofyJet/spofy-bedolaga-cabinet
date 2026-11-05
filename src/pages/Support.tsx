import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { PiCheckBold, PiLockKeyDuotone, PiTelegramLogoDuotone } from 'react-icons/pi';

import { ticketsApi } from '../api/tickets';
import { infoApi } from '../api/info';
import { ticketNotificationsApi } from '../api/ticketNotifications';
import { useBranding } from '@/hooks/useBranding';
import { SUPPORT_CHAT_KEY, SUPPORT_LIST_KEY } from '@/hooks/useSupportUnread';
import { usePlatform } from '@/platform';
import { Skeleton } from '@/components/ui/skeleton';
import { Chip, Group, Page, Row } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import { resolveSupportContact } from '../utils/supportContact';
import { isTicketOpen } from '../utils/supportChat';
import { uiLocale } from '@/utils/uiLocale';
import type { Ticket } from '../types';

import './support.css';

const UNREAD_KEY = [...SUPPORT_CHAT_KEY, 'unread-tickets'] as const;

/** «14:05» сегодня, «2 ноября» раньше. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(
    uiLocale(),
    sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long' },
  ).format(d);
}

/**
 * Поддержка — обращения, как тикеты в боте, списком как в мессенджере.
 * «Обращения»: открытое (в него и пишут — бот держит одно открытое), а если
 * его нет — строка-приглашение от поддержки, которая начинает новое.
 * «Архив»: закрытые. Каждое обращение — свой чат (/support/:id).
 */
export default function Support() {
  const { t } = useTranslation();
  const { appName, logoUrl, hasCustomLogo, logoLetter } = useBranding();
  const { openTelegramLink, openLink } = usePlatform();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'archive' ? 'archive' : 'current';
  const setTab = (next: 'archive' | 'current') =>
    setParams(next === 'archive' ? { tab: 'archive' } : {}, { replace: true });

  const { data: supportConfig, isLoading: configLoading } = useQuery({
    queryKey: ['support-config'],
    queryFn: infoApi.getSupportConfig,
  });
  const chatEnabled = supportConfig?.tickets_enabled === true;

  const { data: ticketsPage, isLoading: listLoading } = useQuery({
    queryKey: SUPPORT_LIST_KEY,
    queryFn: () => ticketsApi.getTickets({ page: 1, per_page: 20 }),
    enabled: chatEnabled,
  });
  // Непрочитанные ответы — точкой у обращения.
  const { data: unread } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => ticketNotificationsApi.getNotifications(true, 50),
    enabled: chatEnabled,
    retry: false,
  });
  const unreadIds = new Set((unread?.items ?? []).map((n) => n.ticket_id));

  const tickets = [...(ticketsPage?.items ?? [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  const open = tickets.find(isTicketOpen) ?? null;
  const closed = tickets.filter((x) => !isTicketOpen(x));

  const contact = supportConfig ? resolveSupportContact(supportConfig) : null;
  const openContact = () => {
    if (!contact) return;
    if (contact.kind === 'external') openLink(contact.url, { tryInstantView: false });
    else openTelegramLink(contact.url);
  };
  const showContactRow =
    !!contact && (supportConfig?.support_type === 'both' || supportConfig?.support_type === 'url');

  const preview = (ticket: Ticket) => {
    const last = ticket.last_message;
    if (!last) return t('support.chat.noMessages');
    const text = last.message_text?.trim() || t('support.chat.mediaMessage');
    return last.is_from_admin ? text : `${t('support.chat.you')}${text}`;
  };

  const avatar = (
    <span className="support-head-avatar" aria-hidden>
      {hasCustomLogo && logoUrl ? <img src={logoUrl} alt="" /> : logoLetter.toUpperCase()}
    </span>
  );

  const header = (
    <header className="support-head support-head-list">
      {avatar}
      <span className="min-w-0 flex-1">
        <h1 className="block truncate text-[17px] font-bold tracking-tight text-dark-50">
          {t('support.chat.title', { name: appName })}
        </h1>
        <span className="mt-0.5 flex items-center gap-2 text-[13px] text-dark-400">
          <span className="support-head-online" aria-hidden />
          {t('support.chat.subtitle')}
        </span>
      </span>
    </header>
  );

  if (configLoading || (chatEnabled && listLoading)) {
    return (
      <Page>
        {header}
        <Skeleton className="h-[76px] w-full rounded-3xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-[140px] w-full rounded-3xl" />
      </Page>
    );
  }

  // Чат выключен в боте — честно ведём туда, где отвечают.
  if (!chatEnabled) {
    return (
      <Page>
        {header}
        <div className="support-empty">
          <p>{t('support.chat.disabled')}</p>
          {contact && (
            <button type="button" onClick={openContact} className="support-empty-btn">
              <PiTelegramLogoDuotone className="h-5 w-5" />
              {t('support.chat.write')}
            </button>
          )}
        </div>
      </Page>
    );
  }

  /** Строка чата, как в мессенджере: аватар, тема, последнее сообщение, время. */
  const chatRow = (o: {
    key: string | number;
    to: string;
    title: string;
    text: string;
    when?: string;
    archived?: boolean;
    trailing?: React.ReactNode;
  }) => (
    <Link
      key={o.key}
      to={o.to}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-dark-800/40 active:bg-dark-800/60"
    >
      <span className="relative shrink-0">
        {o.archived ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dark-800/80 text-dark-300">
            <PiCheckBold className="h-5 w-5" aria-hidden />
          </span>
        ) : (
          <span className="support-row-avatar">{avatar}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[15px] font-semibold',
              o.archived ? 'text-dark-200' : 'text-dark-50',
            )}
          >
            {o.title}
          </span>
          {o.when && <span className="shrink-0 text-[13px] text-dark-400">{o.when}</span>}
        </span>
        <span className="mt-0.5 flex items-start gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] leading-snug text-dark-400">
            {o.text}
          </span>
          {o.trailing}
        </span>
      </span>
    </Link>
  );

  const ticketRow = (ticket: Ticket, isOpen: boolean) => {
    const hasReply = unreadIds.has(ticket.id);
    return chatRow({
      key: ticket.id,
      to: `/support/${ticket.id}`,
      title: ticket.title,
      text: preview(ticket),
      when: whenLabel(ticket.updated_at),
      archived: !isOpen,
      trailing: hasReply ? (
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-400"
          aria-label={t('support.chat.unread')}
        />
      ) : isOpen ? (
        <Chip tone={ticket.status === 'answered' ? 'success' : 'muted'}>
          {ticket.status === 'answered'
            ? t('support.chat.statusAnswered')
            : t('support.chat.statusWaiting')}
        </Chip>
      ) : null,
    });
  };

  return (
    <Page>
      {header}

      {closed.length > 0 && (
        <div className="support-tabs" role="tablist">
          {(['current', 'archive'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="support-tab"
            >
              {key === 'current' ? t('support.chat.tabCurrent') : t('support.chat.tabArchive')}
              {key === 'archive' && <span className="support-tab-count">{closed.length}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'archive' && closed.length > 0 ? (
        <Group>{closed.map((ticket) => ticketRow(ticket, false))}</Group>
      ) : (
        <>
          <Group>
            {open
              ? ticketRow(open, true)
              : chatRow({
                  key: 'new',
                  to: '/support/new',
                  title: t('support.chat.newTicket'),
                  text: t('support.chat.invite'),
                  trailing: (
                    <span className="rounded-full bg-cta-500 px-3.5 py-1.5 text-[13px] font-semibold text-on-cta">
                      {t('support.chat.writeShort')}
                    </span>
                  ),
                })}
          </Group>
        </>
      )}

      {showContactRow && (
        <Group>
          <Row
            icon={<PiTelegramLogoDuotone />}
            iconTone="devices"
            label={t('support.chat.openTelegram')}
            description={t('support.chat.telegramHint')}
            onClick={openContact}
          />
        </Group>
      )}

      <p className="flex items-start gap-2 px-1 text-[13px] leading-snug text-dark-500">
        <PiLockKeyDuotone className="mt-px h-4 w-4 shrink-0" aria-hidden />
        {t('support.chat.safety')}
      </p>
    </Page>
  );
}
