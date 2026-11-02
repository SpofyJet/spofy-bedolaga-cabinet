import type { ReactNode } from 'react';

import type { StoryArtKey, StoryPalette } from './types';

/**
 * Иллюстрации слайдов — параметрические CSS/SVG-мокапы телефона.
 * Никаких внешних картинок: вектор, crisp на любом экране, ноль веса бандла.
 * Текст внутри мокапов — нейтральный UI-хром (как в эталонах: Account,
 * Country/Region), инструкция всегда в заголовке/подзаголовке слайда.
 */

function PhoneFrame({ children, glow }: { children: ReactNode; glow?: string }) {
  return (
    <div
      className="story-phone"
      style={
        glow
          ? { boxShadow: `0 30px 60px -20px rgba(0,0,0,0.45), 0 0 80px -30px ${glow}` }
          : undefined
      }
    >
      <div className="story-phone-notch" />
      <div className="story-phone-screen">{children}</div>
    </div>
  );
}

/** Подсветка целевого элемента — кольцо в акценте серии с мягким свечением. */
function Highlight({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <div
      className="story-highlight"
      style={{ borderColor: accent, boxShadow: `0 0 0 4px ${accent}33, 0 0 24px ${accent}55` }}
    >
      {children}
    </div>
  );
}

function ScreenRow({ children }: { children: ReactNode }) {
  return <div className="story-screen-row">{children}</div>;
}

function Bar({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`story-bar ${className}`} style={style} />;
}

function Globe({ size = 150, opacity = 0.9 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="story-globe"
      style={{ opacity }}
      aria-hidden
    >
      <defs>
        <radialGradient id="story-globe-g" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#story-globe-g)" />
      <g stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" fill="none">
        <ellipse cx="50" cy="50" rx="20" ry="46" />
        <ellipse cx="50" cy="50" rx="38" ry="46" />
        <line x1="4" y1="50" x2="96" y2="50" />
        <path d="M10 32 Q 50 22 90 32" />
        <path d="M10 68 Q 50 78 90 68" />
      </g>
    </svg>
  );
}

function Pin({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 32"
      width="26"
      height="34"
      className={`story-pin ${className}`}
      aria-hidden
    >
      <path
        d="M12 1C6 1 1.5 5.6 1.5 11.3 1.5 19 12 31 12 31s10.5-12 10.5-19.7C22.5 5.6 18 1 12 1z"
        fill="rgba(255,255,255,0.9)"
      />
      <circle cx="12" cy="11" r="4.4" fill="rgba(0,0,0,0.18)" />
    </svg>
  );
}

function Shield({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="story-shield"
      aria-hidden
    >
      <path
        d="M12 2 4 5v6c0 5 3.4 8.8 8 11 4.6-2.2 8-6 8-11V5l-8-3z"
        fill="rgba(255,255,255,0.16)"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.2"
      />
      <path
        d="m8.5 12 2.4 2.4L15.8 9.5"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckMedallion({ accent, size = 150 }: { accent: string; size?: number }) {
  return (
    <div className="story-medallion" style={{ width: size, height: size }}>
      <div
        className="story-medallion-ring"
        style={{ borderColor: `${accent}88`, boxShadow: `0 0 60px -10px ${accent}` }}
      />
      <div className="story-medallion-core">
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m4.5 12.5 5 5 10-11"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function PowerIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M6.3 6.5a8 8 0 1 0 11.4 0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlertMedallion({ accent, size = 140 }: { accent: string; size?: number }) {
  return (
    <div className="story-medallion" style={{ width: size, height: size }}>
      <div
        className="story-medallion-ring"
        style={{ borderColor: `${accent}77`, boxShadow: `0 0 60px -12px ${accent}` }}
      />
      <div className="story-medallion-core">
        <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3 2.5 20h19L12 3z" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
          <line
            x1="12"
            y1="9.5"
            x2="12"
            y2="14"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17" r="1.2" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

/* ---------- Варианты экрана телефона ---------- */

function AccountScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>Account</span>
        <span>✕</span>
      </div>
      <Highlight accent={accent}>
        <div className="flex items-center gap-2.5">
          <div className="story-avatar">ИФ</div>
          <div className="min-w-0 flex-1">
            <Bar className="w-3/4" />
            <Bar className="mt-1.5 w-1/2 opacity-60" />
          </div>
        </div>
      </Highlight>
      <ScreenRow>
        <Bar className="w-2/5" />
        <span className="story-chev">›</span>
      </ScreenRow>
      <ScreenRow>
        <Bar className="w-1/2" />
        <span className="story-chev">›</span>
      </ScreenRow>
      <ScreenRow>
        <Bar className="w-1/3" />
        <span className="story-chev">›</span>
      </ScreenRow>
    </>
  );
}

function CountryScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>Settings</span>
        <span />
      </div>
      <ScreenRow>
        <Bar className="w-1/3 opacity-60" />
      </ScreenRow>
      <Highlight accent={accent}>
        <div className="flex items-center justify-between gap-2">
          <span className="story-label">Country/Region</span>
          <span className="story-label-strong">Kazakhstan ›</span>
        </div>
      </Highlight>
      <ScreenRow>
        <Bar className="w-2/5" />
        <span className="story-chev">›</span>
      </ScreenRow>
    </>
  );
}

function PaymentScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>Add Payment</span>
        <span className="story-label-link">Done</span>
      </div>
      <ScreenRow>
        <div className="min-w-0 flex-1">
          <Bar className="w-3/5" />
          <Bar className="mt-1.5 w-4/5 opacity-50" style={{ height: 6 }} />
        </div>
      </ScreenRow>
      <Highlight accent={accent}>
        <div className="flex items-center justify-between gap-2">
          <span className="story-label-strong">None</span>
          <span className="story-label-link">✓</span>
        </div>
      </Highlight>
    </>
  );
}

function ConnectScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>VPN</span>
        <span />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
        <Highlight accent={accent}>
          <div className="story-power">
            <PowerIcon />
          </div>
        </Highlight>
        <div className="story-label opacity-80">VPN</div>
      </div>
    </>
  );
}

function InstallScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>Profile</span>
        <span />
      </div>
      <div className="flex items-center gap-3">
        <div className="story-app-icon">
          <Shield size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <Bar className="w-2/3" />
          <Bar className="mt-1.5 w-1/3 opacity-50" style={{ height: 6 }} />
        </div>
      </div>
      <Highlight accent={accent}>
        <div className="story-cta-mock">Install</div>
      </Highlight>
      <ScreenRow>
        <Bar className="w-1/2" />
      </ScreenRow>
      <ScreenRow>
        <Bar className="w-2/5 opacity-60" />
      </ScreenRow>
    </>
  );
}

function StatusScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>Subscription</span>
        <span />
      </div>
      <Highlight accent={accent}>
        <div className="flex items-center gap-2">
          <span className="story-dot" style={{ background: accent }} />
          <span className="story-label-strong">Active</span>
        </div>
        <Bar className="mt-2.5 w-1/2 opacity-70" />
        <div className="story-progress">
          <div className="story-progress-fill" style={{ width: '68%', background: accent }} />
        </div>
      </Highlight>
      <ScreenRow>
        <Bar className="w-2/5" />
      </ScreenRow>
      <ScreenRow>
        <Bar className="w-1/2 opacity-60" />
      </ScreenRow>
    </>
  );
}

function RefreshScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>Servers</span>
        <span />
      </div>
      {[0, 1, 2].map((i) => (
        <ScreenRow key={i}>
          <span className="story-dot" style={{ background: 'rgba(255,255,255,0.5)' }} />
          <Bar className="w-2/5" />
        </ScreenRow>
      ))}
      <Highlight accent={accent}>
        <div className="story-refresh-mock">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 12a8 8 0 1 1-2.3-5.6M20 3v5h-5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Highlight>
    </>
  );
}

function ChatScreen({ accent }: { accent: string }) {
  return (
    <>
      <div className="story-phone-nav">
        <span>‹</span>
        <span>Support</span>
        <span />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <div className="story-bubble story-bubble-in">
          <Bar className="w-full" />
          <Bar className="mt-1.5 w-3/5" />
        </div>
        <div className="story-bubble story-bubble-out" style={{ borderColor: `${accent}66` }}>
          <Bar className="w-4/5" />
        </div>
        <div className="story-bubble story-bubble-in">
          <Bar className="w-2/3" />
        </div>
      </div>
    </>
  );
}

/* ---------- Композиции вариантов ---------- */

export function StoryArtwork({ art, palette }: { art: StoryArtKey; palette: StoryPalette }) {
  const { accent } = palette;

  switch (art) {
    case 'globe-intro':
      return (
        <div className="story-art">
          <div className="story-art-deco">
            <Globe size={190} />
            <Pin className="left-[8%] top-[18%]" />
            <Pin className="right-[6%] top-[42%]" />
          </div>
          <PhoneFrame glow={`${accent}55`}>
            <div className="flex h-full flex-col justify-center gap-3 px-1">
              <div className="flex items-center gap-2">
                <span className="story-dot" style={{ background: accent }} />
                <Bar className="w-1/3" />
              </div>
              <Bar className="w-11/12" />
              <Bar className="w-4/5 opacity-60" />
              <div className="story-cta-mock mt-1" style={{ background: `${accent}33` }}>
                Go
              </div>
            </div>
          </PhoneFrame>
        </div>
      );
    case 'shield-intro':
      return (
        <div className="story-art">
          <div className="story-art-deco">
            <Shield size={170} />
          </div>
          <PhoneFrame glow={`${accent}55`}>
            <ConnectScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'alert-intro':
      return (
        <div className="story-art">
          <div className="story-art-deco">
            <AlertMedallion accent={accent} />
          </div>
          <PhoneFrame glow={`${accent}55`}>
            <StatusScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'account':
      return (
        <div className="story-art">
          <PhoneFrame glow={`${accent}44`}>
            <AccountScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'country':
      return (
        <div className="story-art">
          <div className="story-art-deco">
            <Globe size={140} opacity={0.7} />
            <Pin className="right-[10%] top-[16%]" />
          </div>
          <PhoneFrame glow={`${accent}44`}>
            <CountryScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'payment-none':
      return (
        <div className="story-art">
          <div className="story-art-deco story-art-deco-bottom">
            <CheckMedallion accent={accent} size={110} />
          </div>
          <PhoneFrame glow={`${accent}44`}>
            <PaymentScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'connect':
      return (
        <div className="story-art">
          <PhoneFrame glow={`${accent}55`}>
            <ConnectScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'install':
      return (
        <div className="story-art">
          <PhoneFrame glow={`${accent}44`}>
            <InstallScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'status':
      return (
        <div className="story-art">
          <PhoneFrame glow={`${accent}44`}>
            <StatusScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'refresh':
      return (
        <div className="story-art">
          <PhoneFrame glow={`${accent}44`}>
            <RefreshScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    case 'chat':
      return (
        <div className="story-art">
          <PhoneFrame glow={`${accent}44`}>
            <ChatScreen accent={accent} />
          </PhoneFrame>
        </div>
      );
    default:
      return (
        <div className="story-art">
          <div className="story-art-deco">
            <CheckMedallion accent={accent} size={180} />
          </div>
        </div>
      );
  }
}
