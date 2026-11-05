import { useEffect, useRef, useState, memo } from 'react';
import type { WheelPrize } from '../../api/wheel';
import { prizeGlyph } from './PrizeGlyph';

const SIZE = 400;
const CENTER = SIZE / 2;
const SPIN_DURATION_MS = 5000;
/** Пять полных оборотов до целевого сектора. */
const SPIN_EXTRA_TURNS_DEG = 1800;

// Та же кривая, что раньше стояла в CSS-переходе: cubic-bezier(0.15, 0.6, 0.1, 1).
const [EASE_X1, EASE_Y1, EASE_X2, EASE_Y2] = [0.15, 0.6, 0.1, 1];

function bezierAxis(a1: number, a2: number, t: number): number {
  return (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
}

function bezierSlope(a1: number, a2: number, t: number): number {
  return 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
}

/** Доля пути по времени 0..1 → доля поворота 0..1. */
export function spinEasing(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const slope = bezierSlope(EASE_X1, EASE_X2, t);
    if (slope === 0) break;
    t -= (bezierAxis(EASE_X1, EASE_X2, t) - x) / slope;
  }
  return bezierAxis(EASE_Y1, EASE_Y2, Math.min(1, Math.max(0, t)));
}

function rotateAttr(angle: number): string {
  return `rotate(${angle} ${CENTER} ${CENTER})`;
}

interface FortuneWheelProps {
  prizes: WheelPrize[];
  isSpinning: boolean;
  targetRotation: number | null;
  onSpinComplete: () => void;
  /** Короткие подписи секторов («+3 дня», «−10%»), по индексу приза. */
  labels?: string[];
  /** Что показать в центре (например, число бесплатных спинов). */
  hubLabel?: string;
}

const FALLBACK_COLORS = [
  '#2563EB',
  '#0B1F3B',
  '#1E40AF',
  '#2563EB',
  '#0B1F3B',
  '#1E40AF',
  '#1D4ED8',
];
const LED_COUNT = 24;

const FortuneWheel = memo(function FortuneWheel({
  prizes,
  isSpinning,
  targetRotation,
  onSpinComplete,
  labels,
  hubLabel,
}: FortuneWheelProps) {
  const wheelRef = useRef<SVGGElement>(null);
  const accumulatedRotation = useRef(0);
  // Угол покоя: пока идёт спин, React рисует прежний угол и в DOM не лезет,
  // атрибут ведёт кадр за кадром сам спин; по его концу угол покоя догоняет.
  const [restAngle, setRestAngle] = useState(0);
  const latestOnComplete = useRef(onSpinComplete);
  latestOnComplete.current = onSpinComplete;

  useEffect(() => {
    if (!isSpinning || targetRotation === null) return;
    const group = wheelRef.current;
    if (!group) return;
    const from = accumulatedRotation.current;
    let delta = targetRotation - (from % 360);
    while (delta < 0) delta += 360;
    const to = from + SPIN_EXTRA_TURNS_DEG + delta;
    accumulatedRotation.current = to;

    // Крутим SVG-атрибутом по requestAnimationFrame, а не CSS-transform с переходом:
    // CSS-transform на <g> заводит отдельный композитный слой, и Android WebView на
    // части устройств (Xiaomi 12, 17.09.2026) рисует его плитки чёрными квадратами
    // поверх секторов. Атрибут рисуется вместе со всем SVG — компоновать нечего.
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / SPIN_DURATION_MS);
      group.setAttribute('transform', rotateAttr(from + (to - from) * spinEasing(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      setRestAngle(to);
      latestOnComplete.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isSpinning, targetRotation]);

  if (prizes.length === 0) {
    return (
      <div className="mx-auto flex aspect-square w-full max-w-md items-center justify-center">
        <p className="text-dark-400">No prizes configured</p>
      </div>
    );
  }

  const size = SIZE;
  const center = CENTER;
  const ringRadius = 182; // середина обода
  const ringWidth = 16;
  const prizeRadius = ringRadius - ringWidth / 2; // сектора упираются в обод
  const hubRadius = 42;
  const sectorAngle = 360 / prizes.length;
  const dense = prizes.length > 8;
  const emojiRadius = prizeRadius - 28;
  // Подпись идёт вдоль радиуса между эмодзи и хабом — после остановки колеса
  // она читается одинаково в любом секторе, вверх ногами ничего не оказывается.
  const labelRadius = (emojiRadius - 18 + hubRadius + 8) / 2;

  const point = (radius: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [center + radius * Math.cos(rad), center + radius * Math.sin(rad)] as const;
  };

  const sectorPath = (index: number) => {
    const start = index * sectorAngle;
    const end = start + sectorAngle;
    const [x1, y1] = point(prizeRadius, start);
    const [x2, y2] = point(prizeRadius, end);
    const [ix1, iy1] = point(hubRadius, start);
    const [ix2, iy2] = point(hubRadius, end);
    const largeArc = sectorAngle > 180 ? 1 : 0;
    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${prizeRadius} ${prizeRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${hubRadius} ${hubRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
  };

  const sectorColor = (index: number, color?: string) =>
    color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

  return (
    <div className="relative mx-auto w-full max-w-[360px] select-none">
      {/* Мягкое свечение в цвете бренда */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-[-24px] rounded-full transition-opacity duration-500 ${
          isSpinning ? 'opacity-100' : 'opacity-60'
        }`}
        style={{
          background:
            'radial-gradient(circle, rgba(var(--color-accent-500), 0.35) 0%, transparent 65%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Указатель */}
      <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
        <svg width="40" height="50" viewBox="0 0 40 50" className="drop-shadow-lg">
          <path
            d="M20 48 C 14 38, 3 26, 3 17 A 17 17 0 0 1 37 17 C 37 26, 26 38, 20 48 Z"
            fill="#FFFFFF"
            stroke="#0B1F3B"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="17" r="7" style={{ fill: 'rgb(var(--color-accent-500))' }} />
        </svg>
      </div>

      <div className="relative aspect-square">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#0B1F3B" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
            <radialGradient id="hubGrad" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
            {/* Объём секторов: светлее к центру, темнее к краю — одна статичная накладка */}
            <radialGradient id="sectorSheen" cx="50%" cy="50%" r="50%">
              <stop offset="20%" stopColor="#FFFFFF" stopOpacity="0.18" />
              <stop offset="75%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
            </radialGradient>
            <radialGradient id="ledGlowGrad">
              <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Тень под колесом */}
          <circle
            cx={center}
            cy={center + 5}
            r={ringRadius + ringWidth / 2}
            fill="rgba(0,0,0,0.35)"
          />

          {/* Вращающаяся группа — угол атрибутом, см. эффект спина выше */}
          <g ref={wheelRef} transform={rotateAttr(restAngle)}>
            {prizes.map((prize, index) => (
              <path
                key={`sector-${prize.id}`}
                d={sectorPath(index)}
                fill={sectorColor(index, prize.color)}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.5"
              />
            ))}

            {prizes.map((prize, index) => {
              const mid = index * sectorAngle + sectorAngle / 2;
              const label = labels?.[index];
              const emojiY = center - emojiRadius;
              const labelY = center - labelRadius;
              const Glyph = prizeGlyph(prize.prize_type, prize.rarity);
              const glyphSize = dense ? 22 : 28;
              return (
                <g key={`content-${prize.id}`} transform={`rotate(${mid} ${center} ${center})`}>
                  {Glyph ? (
                    <Glyph
                      aria-hidden
                      x={center - glyphSize / 2}
                      y={emojiY - glyphSize / 2}
                      size={glyphSize}
                      color="#FFFFFF"
                    />
                  ) : (
                    <text
                      x={center}
                      y={emojiY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={glyphSize}
                    >
                      {prize.emoji}
                    </text>
                  )}
                  {label && (
                    <text
                      x={center}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={dense ? 11 : label.length > 6 ? 13 : 15}
                      fontWeight="700"
                      fill="#FFFFFF"
                      stroke="rgba(2,6,23,0.35)"
                      strokeWidth="3"
                      paintOrder="stroke"
                      letterSpacing="0.01em"
                      // Подпись идёт вдоль радиуса: на правой половине разворачиваем её,
                      // иначе в покое «−15%» и «+7 дней» стоят вверх ногами.
                      transform={`rotate(${((mid % 360) + 360) % 360 < 180 ? -90 : 90} ${center} ${labelY})`}
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Блик поверх секторов — не вращается, свет «стоит» как у настоящего колеса */}
          <circle
            cx={center}
            cy={center}
            r={prizeRadius}
            fill="url(#sectorSheen)"
            pointerEvents="none"
          />

          {/* Обод и огоньки — после вращающейся группы (см. тест порядка слоёв) */}
          <circle
            cx={center}
            cy={center}
            r={ringRadius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={ringWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={ringRadius + ringWidth / 2}
            fill="none"
            style={{ stroke: 'rgba(var(--color-accent-500), 0.7)' }}
            strokeWidth="2"
          />

          <style>
            {`
              @keyframes ledChase {
                0%, 100% { fill: #334155; }
                10%, 30% { fill: #DBEAFE; }
              }
              @keyframes ledGlow {
                0%, 100% { fill-opacity: 0; }
                10%, 30% { fill-opacity: 0.5; }
              }
              .led-dot { animation: ledChase 6s linear infinite; }
              .led-glow { fill-opacity: 0; animation: ledGlow 6s linear infinite; }
              .led-spinning .led-dot { animation-duration: 1.6s; }
              .led-spinning .led-glow { animation-duration: 1.6s; }
            `}
          </style>
          <g className={isSpinning ? 'led-spinning' : undefined}>
            {Array.from({ length: LED_COUNT }).map((_, i) => {
              const [dotX, dotY] = point(ringRadius, (i * 360) / LED_COUNT);
              const delay = `${(i / LED_COUNT) * 6}s`;
              return (
                <g key={`led-${i}`}>
                  <circle
                    className="led-glow"
                    cx={dotX}
                    cy={dotY}
                    r={8}
                    fill="url(#ledGlowGrad)"
                    style={{ animationDelay: delay }}
                  />
                  <circle
                    className="led-dot"
                    cx={dotX}
                    cy={dotY}
                    r={3}
                    style={{ animationDelay: delay }}
                  />
                </g>
              );
            })}
          </g>

          {/* Ступица */}
          <circle
            cx={center}
            cy={center}
            r={hubRadius}
            fill="url(#hubGrad)"
            stroke="#FFFFFF"
            strokeWidth="3"
          />
          <circle
            cx={center}
            cy={center}
            r={hubRadius - 9}
            fill="none"
            style={{ stroke: 'rgba(var(--color-accent-500), 0.8)' }}
            strokeWidth="2"
          />
          <text
            x={center}
            y={center + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={hubLabel ? 20 : 24}
            fontWeight="800"
            fill="#FFFFFF"
          >
            {isSpinning ? '…' : hubLabel || '🎁'}
          </text>
        </svg>
      </div>
    </div>
  );
});

export default FortuneWheel;
