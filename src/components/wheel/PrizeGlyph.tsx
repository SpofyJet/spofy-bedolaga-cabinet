import type { IconType } from 'react-icons';
import {
  PiArrowsClockwiseBold,
  PiCalendarCheckFill,
  PiCloudArrowDownFill,
  PiCoinsFill,
  PiDeviceMobileFill,
  PiSmileySadFill,
  PiStarFill,
  PiTagFill,
  PiTicketFill,
} from 'react-icons/pi';

const GLYPHS: Record<string, IconType> = {
  subscription_days: PiCalendarCheckFill,
  balance_bonus: PiCoinsFill,
  traffic_gb: PiCloudArrowDownFill,
  promocode: PiTicketFill,
  nothing: PiSmileySadFill,
  device_slot: PiDeviceMobileFill,
  discount: PiTagFill,
  extra_spin: PiArrowsClockwiseBold,
};

/**
 * Значок приза в цвете палитры. Цветные эмодзи из базы выбивались из неё, а календарь
 * ещё и показывал «July». Тип, которого здесь нет (новый приз из админки), вернёт null:
 * тогда вызывающий показывает эмодзи приза как раньше.
 */
export function prizeGlyph(type?: string | null, rarity?: string | null): IconType | null {
  if (rarity === 'jackpot') return PiStarFill;
  return (type && GLYPHS[type]) || null;
}

interface PrizeGlyphProps {
  type?: string | null;
  rarity?: string | null;
  emoji?: string;
  className?: string;
}

/** Значок приза для плиток и списков; вне SVG, поэтому запасной вариант — обычный текст. */
export function PrizeGlyph({ type, rarity, emoji, className }: PrizeGlyphProps) {
  const Glyph = prizeGlyph(type, rarity);
  if (!Glyph) return <>{emoji}</>;
  return <Glyph aria-hidden className={className} />;
}
