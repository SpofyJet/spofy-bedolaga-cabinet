import { describe, expect, it } from 'vitest';
import { required } from './required';

describe('required', () => {
  it('returns present values, including falsy ones', () => {
    expect(required('x')).toBe('x');
    expect(required(0)).toBe(0);
    expect(required('')).toBe('');
    expect(required(false)).toBe(false);
  });

  it('throws on null and undefined', () => {
    expect(() => required(null, 'token')).toThrow('Missing required token');
    expect(() => required(undefined)).toThrow('Missing required value');
  });
});
