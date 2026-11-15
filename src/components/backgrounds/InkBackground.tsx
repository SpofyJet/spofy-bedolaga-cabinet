import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import './ink.css';

/** Цвет и плотность пятна: [r, g, b, альфа в центре]. Только синие — как свечение темы. */
type Ink = readonly [number, number, number, number];

// Тёмная тема: синий акцент #2563eb, глубокий #1e40af и голубой #3b82f6 на фоне #070d1a.
const DARK: readonly Ink[] = [
  [37, 99, 235, 0.34],
  [30, 64, 175, 0.42],
  [59, 130, 246, 0.16],
];
// Светлая: те же оттенки, что у свечения светлой темы (голубой и бирюзовый на #f0f7ff).
const LIGHT: readonly Ink[] = [
  [96, 165, 250, 0.3],
  [34, 211, 238, 0.16],
  [147, 197, 253, 0.34],
];

const SIZE = 96;
// Спад близок к гауссу: без «кольца» на краю пятна после растяжения.
const FALLOFF: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.28, 0.74],
  [0.52, 0.38],
  [0.76, 0.11],
  [1, 0],
];

function paint(canvas: HTMLCanvasElement, [r, g, b, a]: Ink) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const c = SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [stop, k] of FALLOFF) {
    gradient.addColorStop(stop, `rgba(${r}, ${g}, ${b}, ${(a * k).toFixed(3)})`);
  }
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

interface InkBackgroundProps {
  /** Яркость разводов 0.1–1 (настройка в админке). */
  opacity?: number;
  /** Пятна в размер родителя (превью в админке), а не экрана. */
  contained?: boolean;
  className?: string;
}

/**
 * Фон «чернила»: три синих пятна медленно дрейфуют под содержимым (см. ink.css).
 * Пятна рисуются один раз и перерисовываются только при смене темы.
 */
export function InkBackground({ opacity = 1, contained = false, className }: InkBackgroundProps) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const draw = () => {
      const inks = root.classList.contains('light') ? LIGHT : DARK;
      canvases.current.forEach((canvas, i) => {
        if (canvas) paint(canvas, inks[i]);
      });
    };
    draw();
    const observer = new MutationObserver(draw);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn('ink-field', contained && 'ink-contained', className)}
      style={{ opacity }}
      aria-hidden="true"
    >
      {[1, 2, 3].map((n, i) => (
        <canvas
          key={n}
          ref={(el) => {
            canvases.current[i] = el;
          }}
          width={SIZE}
          height={SIZE}
          className={`ink-blob ink-blob-${n}`}
        />
      ))}
    </div>
  );
}
