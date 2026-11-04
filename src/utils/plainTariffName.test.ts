import { describe, expect, it } from 'vitest';

import { plainTariffName } from './plainTariffName';

describe('plainTariffName', () => {
  it('убирает эмодзи в начале названия', () => {
    expect(plainTariffName('👑 ULTIMA')).toBe('ULTIMA');
    expect(plainTariffName('⚡️Стандарт')).toBe('Стандарт');
  });

  it('убирает эмодзи внутри и в конце, схлопывая пробелы', () => {
    expect(plainTariffName('С Обходами 🚀 ')).toBe('С Обходами');
    expect(plainTariffName('Хит 🔥 месяц')).toBe('Хит месяц');
  });

  it('убирает составные эмодзи: флаги, ZWJ-последовательности, тон кожи', () => {
    expect(plainTariffName('🇷🇺 Россия')).toBe('Россия');
    expect(plainTariffName('👨‍👩‍👧 Семья')).toBe('Семья');
    expect(plainTariffName('👍🏽 Базовый')).toBe('Базовый');
  });

  it('не трогает обычный текст, цифры и знаки ©®™', () => {
    expect(plainTariffName('Pro 2 устройства')).toBe('Pro 2 устройства');
    expect(plainTariffName('Spofy™ Plus')).toBe('Spofy™ Plus');
  });

  it('пустое и отсутствующее название отдаёт как есть', () => {
    expect(plainTariffName('')).toBe('');
    expect(plainTariffName(null)).toBeNull();
    expect(plainTariffName(undefined)).toBeUndefined();
  });

  it('название только из эмодзи не превращает в пустую строку', () => {
    expect(plainTariffName('👑')).toBe('👑');
  });
});
