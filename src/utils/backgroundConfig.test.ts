import { describe, expect, it } from 'vitest';
import { validateConfig } from './backgroundConfig';

describe('validateConfig: один фон «чернила»', () => {
  it('принимает свою настройку и держит яркость в 0.1–1', () => {
    expect(validateConfig({ enabled: true, type: 'ink', opacity: 0.6 })).toEqual({
      enabled: true,
      type: 'ink',
      opacity: 0.6,
    });
    expect(validateConfig({ enabled: true, type: 'ink', opacity: 7 })?.opacity).toBe(1);
    expect(validateConfig({ enabled: true, type: 'ink', opacity: 0 })?.opacity).toBe(0.1);
  });

  it('старый эффект из базы читает как «чернила» без его opacity', () => {
    // Так лежит на проде с 2026 года: boxes с opacity 0.1 — при ней «чернил» не видно.
    const legacy = {
      enabled: false,
      type: 'boxes',
      settings: { rows: 20 },
      opacity: 0.1,
      blur: 0,
      reducedOnMobile: true,
    };
    expect(validateConfig(legacy)).toEqual({ enabled: false, type: 'ink', opacity: 1 });
    expect(validateConfig({ ...legacy, enabled: true, type: 'aurora' })?.type).toBe('ink');
  });

  it('none — фон выключен', () => {
    expect(validateConfig({ enabled: true, type: 'none', opacity: 1 })?.type).toBe('none');
  });

  it('не настройка фона — null', () => {
    expect(validateConfig(null)).toBeNull();
    expect(validateConfig([])).toBeNull();
    expect(validateConfig({ type: 'ink' })).toBeNull();
    expect(validateConfig({ enabled: true, type: 5 })).toBeNull();
  });
});
