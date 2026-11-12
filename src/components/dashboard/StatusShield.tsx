import { useId } from 'react';

/**
 * Щит бренда как знак состояния на главной: залитый зелёный — VPN работает,
 * контур — нет (жёлтый — скоро выключится, красный — выключен, серый — подписки нет).
 *
 * Отдельным файлом, потому что это логотип, а не иконка: рукописный <svg> разрешён
 * только в перечисленных местах (noHandDrawnIcons.test.ts), и карточке состояния
 * в этом списке делать нечего.
 */
export type StatusTone = 'ok' | 'warn' | 'off' | 'idle';

const BODY =
  'M821.892 4.22852C842.926 -1.41034 865.074 -1.41035 886.108 4.22852L1017.21 39.376C1027.71 42.1885 1035 51.6963 1035 62.5576V178.281C1035 218.016 1015.96 255.344 983.789 278.669L868.088 362.561C859.684 368.654 848.316 368.654 839.912 362.561L724.211 278.669C692.042 255.344 673 218.016 673 178.281V62.5576C673 51.6963 680.294 42.1885 690.785 39.376L821.892 4.22852Z';
const HELM =
  'M961 142.77C915.823 30.3092 798.843 69.2012 746 102.705C758.7 111.532 786.686 130.953 797.028 138.014C826.965 122.395 850.778 125.111 862.345 129.188C829.143 127.558 807.235 137.563 800.431 142.77L803.152 207.284L827.646 233.77L838.531 197.098L856.902 188.27L843.975 231.053L869.148 265.008L877.994 301L914.054 216.112L893.643 163.822L933.104 201.173C934.692 200.267 940.725 198.184 952.155 197.098C923.307 180.256 914.734 153.862 914.054 142.77L954.877 177.404C956.011 170.84 958.823 154.722 961 142.77Z';

/** Цвет контура и шлема для незалитых щитов (переменные темы: «r, g, b»). */
const SHIELD_TONE: Record<Exclude<StatusTone, 'ok'>, { line: string; helm: string }> = {
  warn: { line: '--color-warning-500', helm: '--color-warning-400' },
  off: { line: '--color-error-500', helm: '--color-error-400' },
  idle: { line: '--color-dark-400', helm: '--color-dark-400' },
};

export function StatusShield({ tone }: { tone: StatusTone }) {
  const gradientId = useId();
  // Цвета — через style: var() в атрибутах SVG браузеры не подставляют.
  return (
    <svg viewBox="663 -10 382 387" className="h-12 w-12 shrink-0" aria-hidden data-tone={tone}>
      {tone === 'ok' ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: 'rgb(var(--color-success-400))' }} />
              <stop offset="1" style={{ stopColor: 'rgb(var(--color-success-600))' }} />
            </linearGradient>
          </defs>
          <path d={BODY} fill={`url(#${gradientId})`} />
          <path d={HELM} fill="#fff" />
        </>
      ) : (
        <>
          <path
            d={BODY}
            strokeWidth={14}
            style={{
              fill: `rgba(var(${SHIELD_TONE[tone].line}), 0.12)`,
              stroke: `rgba(var(${SHIELD_TONE[tone].line}), 0.7)`,
            }}
          />
          <path d={HELM} style={{ fill: `rgba(var(${SHIELD_TONE[tone].helm}), 0.9)` }} />
        </>
      )}
    </svg>
  );
}
