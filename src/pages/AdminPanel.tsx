import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { usePermissionStore } from '@/store/permissions';
import { statsApi, type SystemInfo, type DashboardStats } from '@/api/admin';
import { EmptyState, Group, Page, Row, Stat, Surface } from '@/components/spofy/ui';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUpIcon,
  BellIcon,
  BroadcastIcon,
  CabinetIcon,
  ChartBarIcon,
  ClipboardIcon,
  CreditCardIcon,
  FileTextIcon,
  GiftIcon,
  HistoryIcon,
  LifebuoyIcon,
  LockIcon,
  MailIcon,
  MegaphoneIcon,
  NewsIcon,
  PartnerIcon,
  PercentIcon,
  PinIcon,
  RemnawaveIcon,
  SearchIcon,
  SendIcon,
  ServerIcon,
  SettingsIcon,
  ShareIcon,
  ShieldIcon,
  SparklesIcon,
  StatsChartIcon,
  SyncIcon,
  TagIcon,
  TicketIcon,
  TrafficIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  WheelIcon,
  XIcon,
  RadarIcon,
  WallIcon,
} from '@/components/icons';

const CABINET_VERSION = __APP_VERSION__;

// Section nav icons (24x24 viewBox)
const icons = {
  'bar-chart': <ChartBarIcon />,
  'credit-card': <CreditCardIcon />,
  activity: <TrafficIcon />,
  trending: <StatsChartIcon />,
  users: <UsersIcon />,
  ticket: <TicketIcon />,
  'shield-alert': <ShieldIcon />,
  tag: <TagIcon />,
  gift: <GiftIcon />,
  percent: <PercentIcon />,
  sparkle: <SparklesIcon />,
  wallet: <WalletIcon />,
  layout: <CabinetIcon />,
  newspaper: <NewsIcon />,
  megaphone: <MegaphoneIcon />,
  send: <SendIcon />,
  pin: <PinIcon />,
  bell: <BellIcon />,
  'circle-dot': <WheelIcon />,
  handshake: <PartnerIcon />,
  'arrow-up': <ArrowUpIcon />,
  network: <ShareIcon />,
  radio: <BroadcastIcon />,
  settings: <SettingsIcon />,
  app: <CabinetIcon />,
  server: <ServerIcon />,
  remnawave: <RemnawaveIcon />,
  radar: <RadarIcon />,
  wall: <WallIcon />,
  mail: <MailIcon />,
  refresh: <SyncIcon />,
  shield: <ShieldIcon />,
  'user-check': <UserPlusIcon />,
  lifebuoy: <LifebuoyIcon />,
  lock: <LockIcon />,
  scroll: <HistoryIcon />,
  'list-checks': <ClipboardIcon />,
  search: <SearchIcon />,
  'file-text': <FileTextIcon />,
  x: <XIcon />,
} as const;

type IconName = keyof typeof icons;

// ─── Section Data ───

interface AdminNavItem {
  name: string;
  icon: IconName;
  to: string;
  permission: string;
}

interface AdminSection {
  id: string;
  titleKey: string;
  items: AdminNavItem[];
}

const sections: AdminSection[] = [
  {
    id: 'analytics',
    titleKey: 'admin.groups.analytics',
    items: [
      {
        name: 'admin.nav.dashboard',
        icon: 'bar-chart',
        to: '/admin/dashboard',
        permission: 'stats:read',
      },
      {
        name: 'admin.nav.payments',
        icon: 'credit-card',
        to: '/admin/payments',
        permission: 'payments:read',
      },
      {
        name: 'admin.nav.trafficUsage',
        icon: 'activity',
        to: '/admin/traffic-usage',
        permission: 'traffic:read',
      },
      {
        name: 'admin.nav.salesStats',
        icon: 'trending',
        to: '/admin/sales-stats',
        permission: 'sales_stats:read',
      },
    ],
  },
  {
    id: 'users',
    titleKey: 'admin.groups.users',
    items: [
      { name: 'admin.nav.users', icon: 'users', to: '/admin/users', permission: 'users:read' },
      {
        name: 'admin.nav.bulkActions',
        icon: 'list-checks',
        to: '/admin/bulk-actions',
        permission: 'bulk_actions:read',
      },
      {
        name: 'admin.nav.tickets',
        icon: 'ticket',
        to: '/admin/tickets',
        permission: 'tickets:read',
      },
      {
        name: 'admin.nav.banSystem',
        icon: 'shield-alert',
        to: '/admin/ban-system',
        permission: 'ban_system:read',
      },
    ],
  },
  {
    id: 'tariffs',
    titleKey: 'admin.groups.tariffs',
    items: [
      { name: 'admin.nav.tariffs', icon: 'tag', to: '/admin/tariffs', permission: 'tariffs:read' },
      {
        name: 'admin.nav.promocodes',
        icon: 'gift',
        to: '/admin/promocodes',
        permission: 'promocodes:read',
      },
      {
        name: 'admin.nav.coupons',
        icon: 'ticket',
        to: '/admin/coupons',
        permission: 'coupons:read',
      },
      {
        name: 'admin.nav.promoGroups',
        icon: 'percent',
        to: '/admin/promo-groups',
        permission: 'promo_groups:read',
      },
      {
        name: 'admin.nav.promoOffers',
        icon: 'sparkle',
        to: '/admin/promo-offers',
        permission: 'promo_offers:read',
      },
      {
        name: 'admin.nav.paymentMethods',
        icon: 'wallet',
        to: '/admin/payment-methods',
        permission: 'payment_methods:read',
      },
      {
        name: 'admin.nav.landings',
        icon: 'layout',
        to: '/admin/landings',
        permission: 'landings:read',
      },
    ],
  },
  {
    id: 'marketing',
    titleKey: 'admin.groups.marketing',
    items: [
      { name: 'admin.nav.news', icon: 'newspaper', to: '/admin/news', permission: 'news:read' },
      {
        name: 'admin.nav.campaigns',
        icon: 'megaphone',
        to: '/admin/campaigns',
        permission: 'campaigns:read',
      },
      {
        name: 'admin.nav.broadcasts',
        icon: 'send',
        to: '/admin/broadcasts',
        permission: 'broadcasts:read',
      },
      {
        name: 'admin.nav.pinnedMessages',
        icon: 'pin',
        to: '/admin/pinned-messages',
        permission: 'pinned_messages:read',
      },
      {
        name: 'admin.nav.reminders',
        icon: 'bell',
        to: '/admin/reminders',
        permission: 'user_reminders:read',
      },
      { name: 'admin.nav.wheel', icon: 'circle-dot', to: '/admin/wheel', permission: 'wheel:read' },
      {
        name: 'admin.nav.partners',
        icon: 'handshake',
        to: '/admin/partners',
        permission: 'partners:read',
      },
      {
        // Раньше страница уровней открывалась только из Партнёры → Настройки, и
        // включив многоуровневую схему, админ не находил её в меню вовсе.
        // Пункт показывается всегда, а не при включённой схеме: саму схему
        // переключают с этой же страницы, и условный пункт замкнул бы круг.
        name: 'admin.nav.referralLevels',
        icon: 'trending',
        to: '/admin/partners/referral-levels',
        // Совпадает с правом, которое требуют и маршрут, и все эндпоинты уровней.
        permission: 'partners:settings',
      },
      {
        name: 'admin.nav.withdrawals',
        icon: 'arrow-up',
        to: '/admin/withdrawals',
        permission: 'withdrawals:read',
      },
      {
        name: 'admin.nav.referralNetwork',
        icon: 'network',
        to: '/admin/referral-network',
        permission: 'stats:read',
      },
    ],
  },
  {
    id: 'system',
    titleKey: 'admin.groups.system',
    items: [
      {
        name: 'admin.nav.channelSubscriptions',
        icon: 'radio',
        to: '/admin/channel-subscriptions',
        permission: 'channels:read',
      },
      {
        name: 'admin.nav.settings',
        icon: 'settings',
        to: '/admin/settings',
        permission: 'settings:read',
      },
      {
        // Настройки grace-доступа существуют и на общей странице настроек — там это
        // двенадцать несвязанных строк. Тут они собраны вместе с проверкой конфигурации
        // и состоянием сессий, поэтому и пункт меню отдельный.
        name: 'admin.nav.graceAccess',
        icon: 'lifebuoy',
        to: '/admin/grace-access',
        // То же право, что у страницы настроек и у эндпоинтов раздела.
        permission: 'settings:read',
      },
      { name: 'admin.nav.apps', icon: 'app', to: '/admin/apps', permission: 'apps:read' },
      {
        name: 'admin.nav.servers',
        icon: 'server',
        to: '/admin/servers',
        permission: 'servers:read',
      },
      {
        name: 'admin.nav.remnawave',
        icon: 'remnawave',
        to: '/admin/remnawave',
        permission: 'remnawave:read',
      },
      {
        name: 'admin.nav.reachability',
        icon: 'radar',
        to: '/admin/reachability',
        permission: 'reachability:read',
      },
      {
        name: 'admin.nav.dpichecker',
        icon: 'wall',
        to: '/admin/dpichecker',
        permission: 'dpichecker:read',
      },
      {
        name: 'admin.nav.emailTemplates',
        icon: 'mail',
        to: '/admin/email-templates',
        permission: 'email_templates:read',
      },
      {
        name: 'admin.nav.infoPages',
        icon: 'file-text',
        to: '/admin/info-pages',
        permission: 'info_pages:read',
      },
      {
        name: 'admin.nav.legalPages',
        icon: 'file-text',
        to: '/admin/legal-pages',
        permission: 'info_pages:read',
      },
      {
        name: 'admin.nav.updates',
        icon: 'refresh',
        to: '/admin/updates',
        permission: 'updates:read',
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'admin.groups.security',
    items: [
      { name: 'admin.nav.roles', icon: 'shield', to: '/admin/roles', permission: 'roles:read' },
      {
        name: 'admin.nav.roleAssign',
        icon: 'user-check',
        to: '/admin/roles/assign',
        permission: 'roles:assign',
      },
      { name: 'admin.nav.policies', icon: 'lock', to: '/admin/policies', permission: 'roles:read' },
      {
        name: 'admin.nav.auditLog',
        icon: 'scroll',
        to: '/admin/audit-log',
        permission: 'audit_log:read',
      },
      {
        name: 'admin.nav.systemErrors',
        icon: 'shield',
        to: '/admin/system-errors',
        permission: 'system_errors:read',
      },
    ],
  },
];

// ─── Helpers ───

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Highlighted({ text, term }: { text: string; term: string }) {
  const index = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-accent-400/30 text-dark-100">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}

// ─── Main Component ───

export default function AdminPanel() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const systemInfoQuery = useQuery<SystemInfo>({
    queryKey: ['admin-panel-system-info'] as const,
    queryFn: () => statsApi.getSystemInfo(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const dashboardStatsQuery = useQuery<DashboardStats>({
    queryKey: ['admin-panel-dashboard-stats'] as const,
    queryFn: () => statsApi.getDashboardStats(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const systemInfo = systemInfoQuery.data;
  const subscriptions = dashboardStatsQuery.data?.subscriptions;
  const purchasedToday = subscriptions?.purchased_today ?? 0;

  // Keyboard shortcuts: Cmd+K to focus search, Escape to clear
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearch('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const term = search.trim();
  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              hasPermission(item.permission) &&
              (!term || t(item.name).toLowerCase().includes(term.toLowerCase())),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [hasPermission, term, t],
  );

  const versions = systemInfo && [
    `${t('admin.panel.statsBot')} ${systemInfo.bot_version}`,
    `${t('admin.panel.statsCabinet')} v${CABINET_VERSION}`,
    `${t('admin.panel.statsUptime')} ${formatUptime(systemInfo.uptime_seconds)}`,
  ];

  return (
    <Page>
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight text-dark-50">{t('admin.panel.title')}</h1>
        {versions ? (
          <p className="mt-1 truncate text-[13px] text-dark-400">{versions.join(' · ')}</p>
        ) : (
          <Skeleton className="mt-1.5 h-4 w-56" />
        )}
      </header>

      <Surface className="grid grid-cols-2 gap-4">
        <Stat
          label={t('admin.panel.statsTrials')}
          value={
            subscriptions ? subscriptions.trial.toLocaleString() : <Skeleton className="h-8 w-20" />
          }
        />
        <Stat
          label={t('admin.panel.statsPaid')}
          value={
            subscriptions ? subscriptions.paid.toLocaleString() : <Skeleton className="h-8 w-20" />
          }
          hint={
            purchasedToday > 0 ? `+${purchasedToday} ${t('admin.panel.statsToday')}` : undefined
          }
        />
      </Surface>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dark-500 [&>svg]:h-5 [&>svg]:w-5">
          {icons.search}
        </span>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.panel.searchPlaceholder')}
          aria-label={t('admin.panel.searchPlaceholder')}
          className="h-12 w-full rounded-2xl bg-dark-900/70 pl-12 pr-12 text-[15px] text-dark-100 outline-none placeholder:text-dark-500 focus:bg-dark-800/70"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label={t('admin.panel.searchClear')}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-dark-400 [&>svg]:h-4 [&>svg]:w-4"
          >
            {icons.x}
          </button>
        )}
      </div>

      {visibleSections.length > 0 ? (
        visibleSections.map((section) => (
          <Group key={section.id} title={t(section.titleKey)}>
            {section.items.map((item) => (
              <Row
                key={item.to}
                to={item.to}
                icon={icons[item.icon]}
                label={<Highlighted text={t(item.name)} term={term} />}
              />
            ))}
          </Group>
        ))
      ) : (
        <div role="status" aria-live="polite">
          <EmptyState
            icon={icons.search}
            title={t('admin.panel.searchEmpty')}
            text={t('admin.panel.searchEmptyHint')}
          />
        </div>
      )}
    </Page>
  );
}
