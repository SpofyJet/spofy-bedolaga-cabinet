import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { tariffTrafficLabel } from './tariffTrafficLabel';

const t = ((key: string, opts?: string | { defaultValue?: string; gb?: number }) => {
  const fallback = typeof opts === 'string' ? opts : (opts?.defaultValue ?? key);
  return typeof opts === 'object' && opts?.gb !== undefined
    ? fallback.replace('{{gb}}', String(opts.gb))
    : fallback;
}) as unknown as TFunction;

describe('tariffTrafficLabel', () => {
  it('безлимит и обычный лимит — как раньше', () => {
    expect(tariffTrafficLabel(0, t)).toBe('Безлимит');
    expect(tariffTrafficLabel(200, t)).toBe('200 ГБ');
  });

  it('у тарифа с обходами лимит — только на обходы: «Безлимит + 50 ГБ обходов»', () => {
    expect(tariffTrafficLabel(50, t, true)).toBe('Безлимит + 50 ГБ обходов');
    // Признак без лимита ничего не меняет.
    expect(tariffTrafficLabel(0, t, true)).toBe('Безлимит');
  });
});
