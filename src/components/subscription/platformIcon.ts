import type { IconType } from 'react-icons';
import {
  PiDeviceMobileDuotone,
  PiDeviceMobileFill,
  PiLaptopDuotone,
  PiLaptopFill,
  PiMonitorDuotone,
  PiMonitorFill,
  PiTelevisionDuotone,
  PiTelevisionFill,
} from 'react-icons/pi';

export type DevicePlatformKind = 'tv' | 'mobile' | 'computer' | 'other';

/**
 * Вид устройства по строке платформы из панели («iOS», «Android TV», «Windows»…).
 * ТВ проверяется первым: «Android TV» — телевизор, а не телефон.
 */
export function devicePlatformKind(platform: string | null | undefined): DevicePlatformKind {
  const p = (platform || '').toLowerCase();
  if (/tv|android ?tv|tizen|webos|apple ?tv/.test(p)) return 'tv';
  if (/ios|iphone|ipad|android/.test(p)) return 'mobile';
  if (/mac|windows|linux|desktop/.test(p)) return 'computer';
  return 'other';
}

const ICONS: Record<'fill' | 'duotone', Record<DevicePlatformKind, IconType>> = {
  fill: {
    tv: PiTelevisionFill,
    mobile: PiDeviceMobileFill,
    computer: PiLaptopFill,
    other: PiMonitorFill,
  },
  duotone: {
    tv: PiTelevisionDuotone,
    mobile: PiDeviceMobileDuotone,
    computer: PiLaptopDuotone,
    other: PiMonitorDuotone,
  },
};

/** Иконка платформы: заливка — для плиток главной, duotone — для строк списков. */
export function platformIcon(
  platform: string | null | undefined,
  variant: 'fill' | 'duotone' = 'fill',
): IconType {
  return ICONS[variant][devicePlatformKind(platform)];
}
