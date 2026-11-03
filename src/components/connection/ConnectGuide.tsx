import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import {
  PiArrowSquareOutBold,
  PiBookOpenTextDuotone,
  PiCheckBold,
  PiCopyBold,
  PiDownloadSimpleBold,
  PiInfoDuotone,
  PiPlusBold,
  PiQrCodeDuotone,
} from 'react-icons/pi';

import { Button, Group, Row, SectionTitle, Surface } from '@/components/spofy/ui';
import { cn } from '@/lib/utils';
import type {
  AppConfig,
  LocalizedText,
  RemnawaveAppClient,
  RemnawaveButtonClient,
  RemnawavePlatformData,
} from '@/types';
import { copyToClipboard } from '@/utils/clipboard';
import { collapseDoubledCryptPrefix, hasTemplates, resolveTemplate } from '@/utils/templateEngine';

import { getAppLogo, isAllowedApp, isDefaultApp } from './appLogos';
import TvQuickConnect from './TvQuickConnect';

/**
 * «Как подключиться» — как на sub.spofyltd.ru: устройство и приложение выбираются
 * плитками (определённое устройство и рекомендуемое приложение уже выбраны), все
 * шаги открыты и пронумерованы, кнопки — внутри шагов, после действия у шага
 * появляется галочка. Только Happ и INCY.
 */

const PLATFORM_ORDER = ['ios', 'android', 'windows', 'macos', 'linux', 'androidTV', 'appleTV'];
const TV_PLATFORMS = ['androidTV', 'appleTV'];
const FALLBACK_NAMES: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  androidTV: 'Android TV',
  appleTV: 'Apple TV',
};

// eslint-disable-next-line no-script-url
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

function isValidDeepLink(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  if (DANGEROUS_SCHEMES.some((s) => lower.startsWith(s))) return false;
  return lower.includes('://');
}

function isValidExternalUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  if (DANGEROUS_SCHEMES.some((s) => lower.startsWith(s))) return false;
  return lower.startsWith('http://') || lower.startsWith('https://');
}

/** Устройство посетителя по user agent (как на странице подписки). */
export function detectPlatform(ua: string, maxTouchPoints: number): string | null {
  if (/AppleTV|tvOS/i.test(ua)) return 'appleTV';
  if (/Android.*\b(TV|AFT\w*)\b|Google ?TV|Chromecast|BRAVIA|\bAFT[A-Z]/i.test(ua))
    return 'androidTV';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'; // iPadOS с десктопным UA
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux';
  return null;
}

/** Только Happ и INCY; если панель назвала их иначе — показываем её приложения как есть. */
export function connectablePlatforms(config: AppConfig) {
  const platforms = config.platforms ?? {};
  const anyAllowed = PLATFORM_ORDER.some((key) =>
    (platforms[key]?.apps ?? []).some((app) => isAllowedApp(app.name)),
  );
  const appsOf = (key: string): RemnawaveAppClient[] =>
    (platforms[key]?.apps ?? []).filter((app) => !anyAllowed || isAllowedApp(app.name));
  const available = PLATFORM_ORDER.filter((key) => appsOf(key).length > 0);
  return { appsOf, available };
}

/** INCY первым (рекомендуем), иначе featured из панели (Happ), иначе первое. */
function orderApps(apps: RemnawaveAppClient[]) {
  const recommended =
    apps.find((app) => isDefaultApp(app.name)) ?? apps.find((app) => app.featured) ?? apps[0];
  const sorted = [...apps].sort(
    (a, b) => Number(b.name === recommended?.name) - Number(a.name === recommended?.name),
  );
  return { recommended, sorted };
}

interface Props {
  appConfig: AppConfig;
  username?: string;
  isTelegramWebApp: boolean;
  onOpenDeepLink: (url: string) => void;
  onOpenQR?: () => void;
  /** Что копирует «Скопировать ссылку», если в шаге панели нет своей кнопки копирования. */
  copyUrl: string | null;
}

export default function ConnectGuide({
  appConfig,
  username,
  isTelegramWebApp,
  onOpenDeepLink,
  onOpenQR,
  copyUrl,
}: Props) {
  const { t, i18n } = useTranslation();

  const localized = useCallback(
    (text: LocalizedText | undefined): string => {
      if (!text) return '';
      const lang = i18n.language || 'en';
      return text[lang] || text.en || text.ru || Object.values(text)[0] || '';
    },
    [i18n.language],
  );

  const svgHtml = useCallback(
    (key: string | undefined): string => {
      if (!key || !appConfig.svgLibrary?.[key]) return '';
      const entry = appConfig.svgLibrary[key];
      const raw = typeof entry === 'string' ? entry : entry.svgString;
      if (!raw) return '';
      return DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } });
    },
    [appConfig.svgLibrary],
  );

  const { appsOf, available } = useMemo(() => connectablePlatforms(appConfig), [appConfig]);
  const detected = useMemo(
    () =>
      typeof navigator === 'undefined'
        ? null
        : detectPlatform(navigator.userAgent ?? '', navigator.maxTouchPoints ?? 0),
    [],
  );

  const [platform, setPlatform] = useState<string | undefined>(() =>
    detected && available.includes(detected) ? detected : available[0],
  );
  // Выбранное приложение на каждой платформе (на этот визит).
  const [pickedApp, setPickedApp] = useState<Record<string, string>>({});
  // Выполненные шаги: ключ «платформа:приложение» → номера шагов.
  const [doneSteps, setDoneSteps] = useState<Record<string, number[]>>({});

  const current = platform && available.includes(platform) ? platform : available[0];
  if (!current) return null;

  const { recommended, sorted: apps } = orderApps(appsOf(current));
  const app = apps.find((a) => a.name === pickedApp[current]) ?? apps[0];
  if (!app) return null;

  const platformName = (key: string) => {
    const data = appConfig.platforms[key] as RemnawavePlatformData | undefined;
    return (
      localized(data?.displayName) ||
      localized(appConfig.platformNames?.[key]) ||
      FALLBACK_NAMES[key] ||
      key
    );
  };

  const stepsKey = `${current}:${app.name}`;
  const markDone = (index: number) =>
    setDoneSteps((all) => {
      const list = all[stepsKey] ?? [];
      return list.includes(index) ? all : { ...all, [stepsKey]: [...list, index] };
    });

  const userIsOnTv = detected === 'androidTV' || detected === 'appleTV';
  const isTvPlatform = TV_PLATFORMS.includes(current);
  const showTvConnect =
    isTvPlatform && !userIsOnTv && Boolean(appConfig.subscriptionUrl) && isHappApp(app);
  const tutorialUrl =
    appConfig.baseSettings?.isShowTutorialButton && appConfig.baseSettings?.tutorialUrl
      ? appConfig.baseSettings.tutorialUrl
      : null;

  return (
    <>
      {available.length > 1 && (
        <section>
          <SectionTitle>{t('subscription.connection.yourDevice')}</SectionTitle>
          <ChoiceGroup
            label={t('subscription.connection.yourDevice')}
            variant="tile"
            value={current}
            onSelect={setPlatform}
            items={available.map((key) => ({
              key,
              label: platformName(key),
              icon: (
                <span
                  aria-hidden
                  className="h-6 w-6 text-current [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{
                    __html: svgHtml(
                      (appConfig.platforms[key] as RemnawavePlatformData | undefined)?.svgIconKey,
                    ),
                  }}
                />
              ),
            }))}
          />
        </section>
      )}

      {apps.length > 1 && (
        <section>
          <SectionTitle>{t('subscription.connection.selectApp')}</SectionTitle>
          <ChoiceGroup
            label={t('subscription.connection.selectApp')}
            variant="app"
            value={app.name}
            onSelect={(name) => setPickedApp((all) => ({ ...all, [current]: name }))}
            items={apps.map((item) => ({
              key: item.name,
              label: item.name,
              tag:
                item.name === recommended?.name ? t('subscription.connection.featured') : undefined,
              icon: <AppIcon app={item} svg={svgHtml(item.svgIconKey)} />,
            }))}
          />
        </section>
      )}

      {(isTvPlatform && onOpenQR && appConfig.subscriptionUrl) || tutorialUrl ? (
        <Group>
          {isTvPlatform && onOpenQR && appConfig.subscriptionUrl && (
            <Row
              icon={<PiQrCodeDuotone />}
              label={t('subscription.connection.openQr')}
              description={t(
                'subscription.connection.v10.tvHint',
                'На телевизоре проще отсканировать QR-код',
              )}
              onClick={onOpenQR}
            />
          )}
          {tutorialUrl && (
            <a
              href={tutorialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-dark-800/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400 [&>svg]:h-[22px] [&>svg]:w-[22px]">
                <PiBookOpenTextDuotone />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-dark-100">
                {t('subscription.connection.tutorial')}
              </span>
              <PiArrowSquareOutBold className="h-4 w-4 shrink-0 text-dark-500" aria-hidden />
            </a>
          )}
        </Group>
      ) : null}

      <section>
        <SectionTitle>{t('subscription.connection.v10.steps', 'Шаги')}</SectionTitle>
        <Surface>
          <Steps
            key={stepsKey}
            app={app}
            done={doneSteps[stepsKey] ?? []}
            onDone={markDone}
            localized={localized}
            svgHtml={svgHtml}
            subscriptionUrl={appConfig.subscriptionUrl}
            copyUrl={copyUrl}
            hideLink={appConfig.hideLink ?? false}
            username={username}
            isTelegramWebApp={isTelegramWebApp}
            onOpenDeepLink={onOpenDeepLink}
            tvConnect={
              showTvConnect && appConfig.subscriptionUrl ? (
                <TvQuickConnect subscriptionUrl={appConfig.subscriptionUrl} />
              ) : null
            }
          />
        </Surface>
      </section>
    </>
  );
}

/** Быстрое подключение ТВ (check.happ.su/sendtv) — только у Happ. */
function isHappApp(app: RemnawaveAppClient): boolean {
  if ((app.deepLink ?? '').toLowerCase().startsWith('happ://')) return true;
  return app.name.toLowerCase().includes('happ');
}

function AppIcon({ app, svg }: { app: RemnawaveAppClient; svg: string }) {
  const logo = getAppLogo(app.name);
  if (logo?.src) {
    return (
      <span aria-hidden className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
        <img alt="" decoding="async" src={logo.src} className="h-full w-full" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl p-1.5 [&>svg]:h-full [&>svg]:w-full',
        !logo?.tile && 'bg-dark-800 text-dark-200',
      )}
      style={logo?.tile ? { background: logo.tile } : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * Плитки выбора (radiogroup), все видны сразу — без прокрутки вбок.
 * Устройства — плитки (иконка над названием), приложения — две половины.
 */
function ChoiceGroup({
  items,
  label,
  onSelect,
  value,
  variant,
}: {
  items: { icon: React.ReactNode; key: string; label: string; tag?: string }[];
  label: string;
  onSelect: (key: string) => void;
  value: string;
  variant: 'app' | 'tile';
}) {
  const refs = useRef(new Map<string, HTMLButtonElement | null>());
  const onKeys = (event: KeyboardEvent) => {
    const delta = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as const)[
      event.key as 'ArrowRight'
    ];
    if (!delta) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.key === value);
    const next = items[(index + delta + items.length) % items.length];
    if (!next) return;
    onSelect(next.key);
    refs.current.get(next.key)?.focus();
  };
  // 2 → две половины, 3 → один ряд, 4 → 2 × 2, 5–7 → по 3 в ряд
  const n = items.length;
  const cols = variant === 'app' ? Math.min(2, n) : n <= 3 ? n : n === 4 ? 2 : 3;
  // короткий последний ряд (5, 7 систем) делит ширину, а не оставляет дыру справа:
  // сетка из 6 колонок, плитка занимает 2
  const rest = cols === 3 ? n % 3 : 0;
  const spanOf = (index: number) => (rest && index >= n - rest ? 6 / rest : 2);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeys}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${rest ? 6 : cols}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => {
        const checked = item.key === value;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current.set(item.key, el);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onSelect(item.key)}
            style={rest ? { gridColumn: `span ${spanOf(index)}` } : undefined}
            className={cn(
              'min-w-0 rounded-2xl ring-inset transition-colors active:scale-[0.98]',
              variant === 'tile'
                ? 'flex min-h-[76px] flex-col items-center justify-center gap-1.5 px-2 py-3 text-center'
                : 'flex min-h-[64px] items-center gap-3 px-3 py-2.5 text-left',
              checked
                ? 'bg-accent-500/10 text-dark-50 ring-2 ring-accent-500'
                : 'bg-dark-900/70 text-dark-300 ring-1 ring-dark-800/80 hover:bg-dark-800/60',
            )}
          >
            {item.icon}
            {variant === 'app' ? (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-dark-100">
                  {item.label}
                </span>
                {item.tag && (
                  <span className="block truncate text-xs font-medium text-accent-400">
                    {item.tag}
                  </span>
                )}
              </span>
            ) : (
              <span className="w-full break-words text-[13px] font-semibold leading-tight">
                {item.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const smallBtn =
  'inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl bg-dark-800/70 px-4 text-sm font-semibold text-dark-100 ring-1 ring-inset ring-dark-700/60 transition-colors hover:bg-dark-700/70 active:scale-[0.98] disabled:opacity-50';

function Steps({
  app,
  done,
  onDone,
  localized,
  svgHtml,
  subscriptionUrl,
  copyUrl,
  hideLink,
  username,
  isTelegramWebApp,
  onOpenDeepLink,
  tvConnect,
}: {
  app: RemnawaveAppClient;
  done: number[];
  onDone: (index: number) => void;
  localized: (text: LocalizedText | undefined) => string;
  svgHtml: (key: string | undefined) => string;
  subscriptionUrl: string | null;
  copyUrl: string | null;
  hideLink: boolean;
  username?: string;
  isTelegramWebApp: boolean;
  onOpenDeepLink: (url: string) => void;
  tvConnect: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ key: string; text: string } | null>(null);
  const [notOpened, setNotOpened] = useState<number | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const openTimer = useRef<number | undefined>(undefined);
  const stopWatching = useRef<() => void>(() => {});
  useEffect(
    () => () => {
      window.clearTimeout(copyTimer.current);
      window.clearTimeout(openTimer.current);
      stopWatching.current();
    },
    [],
  );

  const blocks = app.blocks.filter(
    (b) => localized(b.title) || localized(b.description) || b.buttons?.length,
  );
  const firstTodo = blocks.findIndex((_, index) => !done.includes(index));
  // Виджет «отправить на ТВ» — в шаге с добавлением подписки.
  const addIndex = blocks.findIndex((b) => b.buttons?.some((x) => x.type === 'subscriptionLink'));
  const tvIndex = addIndex >= 0 ? addIndex : blocks.length >= 3 ? 1 : blocks.length - 1;

  /** Ссылка кнопки «Добавить в …» — как раньше в BlockButtons. */
  const deepLinkOf = (btn: RemnawaveButtonClient): string | null => {
    const raw = btn.resolvedUrl || btn.url || btn.link || app.deepLink || subscriptionUrl;
    const resolved =
      raw && subscriptionUrl && hasTemplates(raw)
        ? resolveTemplate(raw, { subscriptionUrl, username })
        : raw;
    const url = resolved ? collapseDoubledCryptPrefix(resolved) : resolved;
    if (!url || hasTemplates(url) || !isValidDeepLink(url)) return null;
    return url;
  };

  /**
   * Галочка у шага «Добавить» — только если приложение правда открылось (страница
   * ушла в фон). В Telegram ссылка уходит во внешний браузер, а мини-приложение
   * остаётся на экране, поэтому там шаг отмечается сразу после нажатия.
   */
  const openApp = (url: string, index: number) => {
    onOpenDeepLink(url);
    if (isTelegramWebApp) {
      onDone(index);
      return;
    }
    window.clearTimeout(openTimer.current);
    stopWatching.current();
    setNotOpened(null);
    let left = false;
    const away = () => {
      if (left) return;
      left = true;
      window.clearTimeout(openTimer.current);
      cleanup();
      onDone(index);
    };
    const cleanup = () => {
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('blur', away);
    };
    stopWatching.current = cleanup;
    document.addEventListener('visibilitychange', away, { once: true });
    window.addEventListener('blur', away, { once: true });
    openTimer.current = window.setTimeout(() => {
      cleanup();
      if (!left && document.visibilityState === 'visible') setNotOpened(index);
    }, 1600);
  };

  /** Честное копирование: буфер → старый способ → поле для ручного выделения. */
  const copy = async (text: string, key: string, index: number) => {
    let ok = true;
    try {
      await copyToClipboard(text);
    } catch {
      ok = false;
    }
    window.clearTimeout(copyTimer.current);
    if (ok) {
      setFailed(null);
      setCopied(key);
      onDone(index);
      copyTimer.current = window.setTimeout(() => setCopied(null), 2500);
    } else {
      setCopied(null);
      setFailed({ key, text });
    }
  };

  const copyButton = (key: string, text: string, label: string, index: number) => (
    <button
      key={key}
      type="button"
      className={cn(smallBtn, 'flex-1 basis-[140px]')}
      onClick={() => copy(text, key, index)}
    >
      {copied === key ? (
        <PiCheckBold className="h-4 w-4 text-success-400" />
      ) : (
        <PiCopyBold className="h-4 w-4" />
      )}
      <span aria-live="polite">
        {copied === key ? t('subscription.connection.v10.copied', 'Скопировано') : label}
      </span>
    </button>
  );

  return (
    <ol aria-label={`${t('subscription.connection.title')}: ${app.name}`}>
      {blocks.map((block, index) => {
        const isDone = done.includes(index);
        const state = isDone ? 'done' : index === firstTodo ? 'current' : 'todo';
        // «Добавить в …» — главное действие шага, ставим первым.
        const buttons = [...(block.buttons ?? [])].sort(
          (a, b) => Number(b.type === 'subscriptionLink') - Number(a.type === 'subscriptionLink'),
        );
        const hasAdd = buttons.some((b) => b.type === 'subscriptionLink');
        const hasCopy = buttons.some((b) => b.type === 'copyButton');
        const ownCopy = hasAdd && !hasCopy && !hideLink && Boolean(copyUrl);
        const isLast = index === blocks.length - 1;

        const rendered = buttons.map((btn, i) => {
          const key = `${index}:${i}`;
          const text = localized(btn.text);
          if (btn.type === 'subscriptionLink') {
            const url = deepLinkOf(btn);
            if (!url) return null;
            return (
              <Button
                key={key}
                className="w-full"
                title={text || undefined}
                onClick={() => openApp(url, index)}
              >
                <PiPlusBold className="h-[18px] w-[18px]" />
                {t('subscription.connection.addToApp', { appName: app.name })}
              </Button>
            );
          }
          if (btn.type === 'copyButton') {
            if (hideLink) return null;
            const url = btn.resolvedUrl || subscriptionUrl;
            if (!url) return null;
            return copyButton(key, url, text || t('subscription.connection.copyLink'), index);
          }
          const href = btn.link || btn.url || '';
          if (!isValidExternalUrl(href)) return null;
          const icon = svgHtml(btn.svgIconKey);
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(smallBtn, 'flex-1 basis-[140px]')}
              onClick={() => onDone(index)}
            >
              {icon && btn.svgIconKey !== 'ExternalLink' ? (
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: icon }}
                />
              ) : (
                <PiDownloadSimpleBold className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{text}</span>
              <PiArrowSquareOutBold className="h-3.5 w-3.5 shrink-0 text-dark-400" />
            </a>
          );
        });
        const anyCopy = ownCopy || (hasCopy && !hideLink);

        return (
          <li key={index} className={cn('relative flex gap-3', !isLast && 'pb-6')}>
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute bottom-1 left-[15px] top-10 w-0.5 rounded-full',
                  isDone ? 'bg-success-500/30' : 'bg-dark-800',
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                state === 'done' && 'bg-success-500/15 text-success-400',
                state === 'current' && 'bg-accent-500 text-on-accent',
                state === 'todo' && 'bg-dark-800 text-dark-300',
              )}
            >
              {isDone ? <PiCheckBold className="h-4 w-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <h3
                className={cn(
                  'text-[15px] font-semibold leading-snug',
                  isDone ? 'text-dark-300' : 'text-dark-100',
                )}
              >
                {localized(block.title)}
                {isDone && (
                  <span className="sr-only">
                    {' '}
                    — {t('subscription.connection.v10.stepDone', 'выполнено')}
                  </span>
                )}
              </h3>
              {/* выполненный шаг сворачивается до заголовка */}
              {!isDone && localized(block.description) && (
                <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-dark-400">
                  {localized(block.description)}
                </p>
              )}
              {(rendered.some(Boolean) || ownCopy) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {rendered}
                  {ownCopy &&
                    copyUrl &&
                    copyButton(
                      `${index}:own`,
                      copyUrl,
                      t('subscription.connection.copyLink'),
                      index,
                    )}
                </div>
              )}
              {failed?.key.startsWith(`${index}:`) && <ManualCopy text={failed.text} />}
              {anyCopy && !failed?.key.startsWith(`${index}:`) && (
                <p className="mt-2 text-[12.5px] leading-snug text-dark-400">
                  {t(
                    'subscription.connection.v10.personalKey',
                    'Это ваш личный ключ — никому его не пересылайте',
                  )}
                </p>
              )}
              {notOpened === index && (
                <div
                  role="status"
                  className="mt-3 flex gap-2.5 rounded-2xl bg-warning-500/10 px-3.5 py-3 text-warning-400"
                >
                  <PiInfoDuotone className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">
                      {t('subscription.connection.v10.notOpened', 'Приложение не открылось?')}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-dark-300">
                      {t(
                        'subscription.connection.v10.notOpenedText',
                        'Проверьте, что оно установлено (шаг 1). Или скопируйте ссылку и вставьте её в приложении через «+».',
                      )}
                    </p>
                  </div>
                </div>
              )}
              {index === tvIndex && tvConnect}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Телефон не дал скопировать: ссылка в поле, уже выделена — можно скопировать вручную. */
function ManualCopy({ text }: { text: string }) {
  const { t } = useTranslation();
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
    el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, []);
  return (
    <div role="alert" className="mt-3 space-y-2 rounded-2xl bg-warning-500/10 p-3">
      <p className="flex items-start gap-2 text-[13px] leading-snug text-warning-400">
        <PiInfoDuotone className="mt-0.5 h-4 w-4 shrink-0" />
        {t(
          'subscription.connection.v10.copyManual',
          'Телефон не дал скопировать. Нажмите на ссылку и удерживайте, затем выберите «Скопировать».',
        )}
      </p>
      <textarea
        ref={field}
        readOnly
        rows={3}
        spellCheck={false}
        dir="ltr"
        aria-label={t('subscription.connection.copyLink')}
        value={text}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full resize-none break-all rounded-xl bg-dark-900/80 p-2.5 text-[13px] text-dark-100 outline-none ring-1 ring-inset ring-dark-700/60"
      />
    </div>
  );
}
