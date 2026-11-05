import { useTranslation } from 'react-i18next';
import {
  PiAppStoreLogoFill,
  PiGooglePlayLogoFill,
  PiPowerBold,
  PiArrowsClockwiseBold,
  PiCaretRightBold,
  PiCellSignalFullBold,
  PiDeviceMobileFill,
  PiLaptopFill,
  PiPlusBold,
  PiTrashBold,
  PiQrCodeBold,
  PiShieldCheckFill,
  PiLockSimpleFill,
  PiTelegramLogoFill,
  PiTelevisionFill,
  PiCheckCircleFill,
} from 'react-icons/pi';

import { cn } from '@/lib/utils';
import type { StoryVisualKey } from './types';
import { cabinetHost } from './registry';

/**
 * Фрагменты интерфейса для слайдов сторис: показывают ровно то, что человек
 * увидит и нажмёт. Собраны из тех же примитивов, что и кабинет (скругления,
 * hairline-границы, акцент серии), — без рисованных SVG и сгенерированных картинок.
 * Подписи внутри фрагментов — из `stories.ui.*`.
 */

interface VisualProps {
  accent: string;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'w-full max-w-[320px] rounded-[22px] border border-white/10 bg-white/[0.06] p-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Row({
  children,
  highlight,
  accent,
  className,
}: {
  children: React.ReactNode;
  highlight?: boolean;
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold text-white',
        className,
      )}
      style={
        highlight
          ? { background: `${accent}26`, boxShadow: `inset 0 0 0 1.5px ${accent}` }
          : { background: 'rgba(255,255,255,0.04)' }
      }
    >
      {children}
    </div>
  );
}

function AppTile({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-sm font-black tracking-tight text-white"
      style={{ background: `linear-gradient(160deg, ${accent}, ${accent}99)` }}
    >
      {label}
    </span>
  );
}

function Install({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <Panel className="space-y-2">
      <Row accent={accent} highlight>
        <AppTile label="IN" accent={accent} />
        <span className="min-w-0 flex-1">
          <span className="block">INCY</span>
          <span className="block text-xs font-medium text-white/60">
            {t('stories.ui.recommended')}
          </span>
        </span>
        <span
          className="rounded-full px-3 py-1.5 text-xs font-bold text-[#0B1F3B]"
          style={{ background: accent }}
        >
          {t('stories.ui.get')}
        </span>
      </Row>
      <Row accent={accent}>
        <AppTile label="H" accent="#64748B" />
        <span className="min-w-0 flex-1">
          <span className="block">Happ</span>
          <span className="block text-xs font-medium text-white/60">
            {t('stories.ui.alternative')}
          </span>
        </span>
      </Row>
      <div className="flex gap-2 pt-1">
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] py-2.5 text-xs font-semibold text-white/80">
          <PiAppStoreLogoFill className="h-4 w-4" /> App Store
        </span>
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] py-2.5 text-xs font-semibold text-white/80">
          <PiGooglePlayLogoFill className="h-4 w-4" /> Google Play
        </span>
      </div>
    </Panel>
  );
}

function AddSub({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <Panel className="space-y-3 p-4">
      <div className="text-xs font-semibold text-white/50">{t('stories.ui.step2')}</div>
      <div
        className="flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-[#0B1F3B]"
        style={{ background: accent }}
      >
        <PiPlusBold className="h-4 w-4" /> {t('stories.ui.addToIncy')}
      </div>
      <div className="flex items-center justify-center gap-1.5 text-xs text-white/60">
        <PiCheckCircleFill className="h-4 w-4 text-emerald-400" /> {t('stories.ui.autoAdded')}
      </div>
    </Panel>
  );
}

function Power({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <div className="flex w-full max-w-[320px] flex-col items-center gap-6">
      <Panel>
        <Row accent={accent}>
          <span className="text-xl leading-none">🇳🇱</span>
          <span className="flex-1">{t('stories.ui.netherlands')}</span>
          <span className="text-xs font-semibold text-emerald-400">38 {t('stories.ui.ms')}</span>
        </Row>
      </Panel>
      <span
        className="flex h-28 w-28 items-center justify-center rounded-full text-[#0B1F3B]"
        style={{
          background: accent,
          boxShadow: `0 0 0 10px ${accent}22, 0 0 0 22px ${accent}11`,
        }}
      >
        <PiPowerBold className="h-12 w-12" />
      </span>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
        <PiShieldCheckFill className="h-4 w-4" /> {t('stories.ui.connected')}
      </span>
    </div>
  );
}

function Refresh({ accent }: VisualProps) {
  return (
    <Panel className="space-y-2">
      <div className="flex items-center justify-between px-1.5 py-1">
        <span className="text-[15px] font-bold text-white">Spofy VPN</span>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#0B1F3B]"
          style={{ background: accent, boxShadow: `0 0 0 6px ${accent}33` }}
        >
          <PiArrowsClockwiseBold className="h-5 w-5" />
        </span>
      </div>
      {['🇳🇱', '🇩🇪', '🇫🇮'].map((flag, i) => (
        <Row key={flag} accent={accent} className="opacity-60">
          <span className="text-xl leading-none">{flag}</span>
          <span
            className="h-2.5 flex-1 rounded-full bg-white/15"
            style={{ maxWidth: `${70 - i * 12}%` }}
          />
        </Row>
      ))}
    </Panel>
  );
}

function ResetPath({ accent }: VisualProps) {
  const { t } = useTranslation();
  const steps = [t('stories.ui.settings'), t('stories.ui.reset'), t('stories.ui.fullReset')];
  return (
    <Panel className="space-y-2">
      {steps.map((label, i) => {
        const last = i === steps.length - 1;
        return (
          <Row key={label} accent={last ? '#F43F5E' : accent} highlight={last}>
            <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-white/50">
              {i + 1}
            </span>
            <span className={cn('flex-1', last && 'text-rose-300')}>{label}</span>
            <PiCaretRightBold className="h-4 w-4 text-white/50" />
          </Row>
        );
      })}
    </Panel>
  );
}

function Servers({ accent }: VisualProps) {
  const { t } = useTranslation();
  const list = [
    { flag: '🇩🇪', name: t('stories.ui.germany'), ping: 64 },
    { flag: '🇳🇱', name: t('stories.ui.netherlands'), ping: 38, best: true },
    { flag: '🇫🇮', name: t('stories.ui.finland'), ping: 91 },
  ];
  return (
    <Panel className="space-y-2">
      {list.map((s) => (
        <Row key={s.flag} accent={accent} highlight={s.best}>
          <span className="text-xl leading-none">{s.flag}</span>
          <span className="flex-1">{s.name}</span>
          {s.best && (
            <span
              className="rounded-full px-2 py-0.5 text-[13px] font-bold text-[#0B1F3B]"
              style={{ background: accent }}
            >
              {t('stories.ui.best')}
            </span>
          )}
          <span
            className={cn(
              'w-12 text-right text-xs font-semibold',
              s.best ? 'text-emerald-400' : 'text-white/50',
            )}
          >
            {s.ping} {t('stories.ui.ms')}
          </span>
        </Row>
      ))}
    </Panel>
  );
}

function Bypass({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-[320px] space-y-3">
      <Panel>
        <Row accent={accent} highlight>
          <PiCellSignalFullBold className="h-5 w-5" style={{ color: accent }} />
          <span className="min-w-0 flex-1">
            <span className="block">{t('stories.ui.bypass')}</span>
            <span className="block text-xs font-medium text-white/60">
              {t('stories.ui.forMobile')}
            </span>
          </span>
          <span className="relative h-7 w-12 rounded-full" style={{ background: accent }}>
            <span className="absolute right-0.5 top-0.5 h-6 w-6 rounded-full bg-white" />
          </span>
        </Row>
      </Panel>
      <Panel className="p-2.5">
        <div className="flex items-center gap-2.5 px-1 text-xs leading-snug text-white/70">
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[13px] font-bold text-white/80">
            Android
          </span>
          {t('stories.ui.androidProfiles')}
        </div>
      </Panel>
    </div>
  );
}

function Support({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <Panel className="space-y-3 p-4">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2.5">
        <div className="text-xs font-semibold" style={{ color: accent }}>
          {t('stories.ui.supportName')}
        </div>
        <div className="mt-0.5 text-[15px] font-medium text-white">{t('support.chat.welcome')}</div>
      </div>
      <div
        className="ml-auto max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[15px] font-medium text-[#0B1F3B]"
        style={{ background: accent }}
      >
        {t('stories.ui.userMessage')}
      </div>
    </Panel>
  );
}

function Slots({ accent }: VisualProps) {
  const { t } = useTranslation();
  const slot = 'flex h-16 w-16 items-center justify-center rounded-2xl';
  return (
    <Panel className="p-5">
      <div className="flex justify-center gap-3">
        <span className={slot} style={{ background: `${accent}2e`, color: accent }}>
          <PiDeviceMobileFill className="h-7 w-7" />
        </span>
        <span className={slot} style={{ background: `${accent}2e`, color: accent }}>
          <PiLaptopFill className="h-7 w-7" />
        </span>
        <span
          className={cn(slot, 'border-2 border-dashed text-white/70')}
          style={{ borderColor: `${accent}99` }}
        >
          <PiPlusBold className="h-6 w-6" />
        </span>
      </div>
      <div className="mt-4 text-center text-sm font-semibold text-white/80">
        {t('stories.ui.slotsFree')}
      </div>
    </Panel>
  );
}

function Web({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <Panel className="space-y-3 p-4">
      <div className="flex items-center gap-2 rounded-full bg-black/30 px-4 py-2.5 text-sm font-semibold text-white">
        <PiLockSimpleFill className="h-3.5 w-3.5 text-emerald-400" />
        {cabinetHost()}
      </div>
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#2AABEE] py-3.5 text-[15px] font-bold text-white">
        <PiTelegramLogoFill className="h-5 w-5" /> {t('stories.ui.loginTelegram')}
      </div>
      <div
        className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold text-[#0B1F3B]"
        style={{ background: accent }}
      >
        <PiPowerBold className="h-4 w-4" /> {t('dashboard.quick.connect')}
      </div>
    </Panel>
  );
}

function TvQr({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <Panel className="flex flex-col items-center gap-4 p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white text-slate-900">
          <PiQrCodeBold className="h-20 w-20" />
        </span>
        <PiCaretRightBold className="h-5 w-5 text-white/50" />
        <span
          className="flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: `${accent}2e`, color: accent }}
        >
          <PiTelevisionFill className="h-10 w-10" />
        </span>
      </div>
      <div className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-semibold text-white/80">
        {t('stories.ui.qrPath')}
      </div>
    </Panel>
  );
}

function Limit({ accent }: VisualProps) {
  const { t } = useTranslation();
  return (
    <Panel className="space-y-2">
      <Row accent={accent}>
        <PiDeviceMobileFill className="h-5 w-5 text-white/70" />
        <span className="flex-1">iPhone</span>
      </Row>
      <Row accent="#F43F5E" highlight>
        <PiLaptopFill className="h-5 w-5 text-white/70" />
        <span className="flex-1">{t('stories.ui.oldLaptop')}</span>
        <PiTrashBold className="h-5 w-5 text-rose-300" />
      </Row>
      <div
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3 text-sm font-bold text-white"
        style={{ borderColor: `${accent}aa` }}
      >
        <PiPlusBold className="h-4 w-4" /> {t('dashboard.devicesTraffic.addSlot')}
      </div>
    </Panel>
  );
}

const VISUALS: Record<StoryVisualKey, (p: VisualProps) => React.ReactElement> = {
  install: Install,
  'add-sub': AddSub,
  power: Power,
  refresh: Refresh,
  'reset-path': ResetPath,
  servers: Servers,
  bypass: Bypass,
  support: Support,
  slots: Slots,
  web: Web,
  'tv-qr': TvQr,
  limit: Limit,
};

export function StoryVisual({ name, accent }: { name: StoryVisualKey; accent: string }) {
  const Component = VISUALS[name];
  return <Component accent={accent} />;
}
