import { describe, expect, it } from 'vitest';
import { PiDeviceMobileDuotone, PiTelevisionFill } from 'react-icons/pi';

import { devicePlatformKind, platformIcon } from './platformIcon';

describe('devicePlatformKind', () => {
  it.each([
    ['iOS', 'mobile'],
    ['Android', 'mobile'],
    ['iPadOS', 'mobile'],
    ['Android TV', 'tv'],
    ['AndroidTV', 'tv'],
    ['Tizen', 'tv'],
    ['webOS', 'tv'],
    ['Apple TV', 'tv'],
    ['Windows', 'computer'],
    ['macOS', 'computer'],
    ['Linux', 'computer'],
    ['', 'other'],
    [undefined, 'other'],
    ['Roku', 'other'],
  ] as const)('%s → %s', (platform, kind) => {
    expect(devicePlatformKind(platform)).toBe(kind);
  });
});

describe('platformIcon', () => {
  it('отдаёт иконку нужного стиля', () => {
    expect(platformIcon('Android TV')).toBe(PiTelevisionFill);
    expect(platformIcon('iOS', 'duotone')).toBe(PiDeviceMobileDuotone);
  });
});
