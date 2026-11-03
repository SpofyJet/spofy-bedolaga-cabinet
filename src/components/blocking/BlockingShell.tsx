import type { ReactNode, Ref } from 'react';
import { motion } from 'framer-motion';
import { scale, scaleTransition, slideUp, slideUpTransition } from '../motion/transitions';
import { cn } from '@/lib/utils';

export type BlockingAccent = 'warning' | 'error' | 'info';

/**
 * Per-accent class recipe. `info` maps to the theme accent-* scale (default
 * blue). Colors are theme-driven CSS vars (RGB triples), never hardcoded hex.
 */
const accentMap: Record<
  BlockingAccent,
  {
    medallion: string;
    iconColor: string;
    dot: string;
  }
> = {
  warning: {
    medallion: 'bg-warning-500/10 ring-warning-500/25',
    iconColor: 'text-warning-400',
    dot: 'bg-warning-500',
  },
  error: {
    medallion: 'bg-error-500/10 ring-error-500/25',
    iconColor: 'text-error-400',
    dot: 'bg-error-500',
  },
  info: {
    medallion: 'bg-accent-500/10 ring-accent-500/25',
    iconColor: 'text-accent-400',
    dot: 'bg-accent-500',
  },
};

interface BlockingShellProps {
  /** Unique id wired to aria-labelledby (e.g. 'maintenance-title'). */
  titleId: string;
  accent: BlockingAccent;
  /** Rendered icon element (sized by the caller, e.g. <WrenchIcon className="h-9 w-9" />). */
  icon: ReactNode;
  /** Already-translated title. */
  title: string;
  description?: ReactNode;
  /** Per-screen body: reason cards, channel list, error block. */
  children?: ReactNode;
  /** CTA area — pass canonical <Button> elements. */
  actions?: ReactNode;
  /** Hint / contact-support line under the card. */
  footer?: ReactNode;
  /** Accent-tinted "working" dots, for screens that actively wait/poll. */
  pulse?: boolean;
  /** 'polite' for screens whose state changes (retry/error) should announce. */
  ariaLive?: 'polite' | 'off';
  /** Focus-trap ref — owned by the caller so each screen keeps its own trap. */
  screenRef: Ref<HTMLDivElement>;
}

/**
 * Shared shell for every full-screen blocking/status state in the Spofy style:
 * an opaque dark canvas, a flat centered surface and a tinted icon tile —
 * no glow, glass or gradients. Behavior (focus trap, aria, actions) is supplied by each
 * screen; this component owns only the visual chrome.
 */
export default function BlockingShell({
  titleId,
  accent,
  icon,
  title,
  description,
  children,
  actions,
  footer,
  pulse = false,
  ariaLive = 'off',
  screenRef,
}: BlockingShellProps) {
  const a = accentMap[accent];

  return (
    <div
      ref={screenRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-[100] overflow-y-auto bg-dark-950"
    >
      {/* Scroll-safe centering: min-h-full + items-center centers when it fits
          and scrolls without clipping the top when content is tall. */}
      <div className="relative flex min-h-full items-center justify-center p-6">
        <motion.div
          variants={scale}
          initial="initial"
          animate="animate"
          transition={scaleTransition}
          aria-live={ariaLive === 'polite' ? 'polite' : undefined}
          aria-atomic={ariaLive === 'polite' ? true : undefined}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-dark-900/70 p-6 text-center ring-1 ring-inset ring-dark-800/80 sm:p-8"
        >
          {/* Icon tile */}
          <motion.div
            variants={slideUp}
            initial="initial"
            animate="animate"
            transition={slideUpTransition}
            className="mb-6 flex justify-center"
          >
            <span
              className={cn(
                'relative flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-inset',
                a.medallion,
              )}
            >
              <span className={cn('relative', a.iconColor)}>{icon}</span>
            </span>
          </motion.div>

          <h1 id={titleId} className="text-xl font-bold tracking-tight text-dark-50">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-[15px] leading-relaxed text-dark-400">{description}</p>
          )}

          {children && <div className="mt-6 space-y-3 text-left">{children}</div>}

          {actions && <div className="mt-7 flex flex-col gap-3">{actions}</div>}

          {pulse && (
            <div aria-hidden className="mt-7 flex items-center justify-center gap-1.5">
              <span
                className={cn('h-1.5 w-1.5 animate-pulse rounded-full', a.dot)}
                style={{ animationDelay: '0ms' }}
              />
              <span
                className={cn('h-1.5 w-1.5 animate-pulse rounded-full', a.dot)}
                style={{ animationDelay: '300ms' }}
              />
              <span
                className={cn('h-1.5 w-1.5 animate-pulse rounded-full', a.dot)}
                style={{ animationDelay: '600ms' }}
              />
            </div>
          )}

          {footer && <p className="mt-6 text-sm text-dark-500">{footer}</p>}
        </motion.div>
      </div>
    </div>
  );
}
