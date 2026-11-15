import { cn } from '@/lib/utils';
import { InkBackground } from './InkBackground';

interface BackgroundPreviewProps {
  enabled: boolean;
  opacity: number;
  className?: string;
}

/** Превью фона в админке: то же поле «чернил», что и под кабинетом, в размер карточки. */
export function BackgroundPreview({ enabled, opacity, className }: BackgroundPreviewProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-dark-950', className)}>
      {enabled && <InkBackground opacity={opacity} contained />}
    </div>
  );
}
