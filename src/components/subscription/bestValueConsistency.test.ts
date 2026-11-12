import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Отмеченный вариант выглядит одинаково на всех витринах: отметка рядом с названием
 * («Выгодно» у срока, «Советуем» у тарифа) и общее выделение.
 */
const SRC = join(__dirname, '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') && !path.includes('.test.') ? [path] : [];
  });
}

const showcases = tsxFiles(SRC)
  .filter((path) => !path.endsWith('BestValueBadge.tsx'))
  .map((path) => ({ path: relative(SRC, path), code: readFileSync(path, 'utf8') }))
  .filter(({ code }) => code.includes('<BestValueBadge'));

describe('плашка «Выгодно» на витринах', () => {
  it('витрины найдены', () => {
    // Список сроков (PeriodList — один на продление и покупку), список тарифов, подарок.
    expect(showcases.length).toBeGreaterThanOrEqual(3);
  });

  it.each(showcases.map((s) => [s.path, s.code]))(
    '%s: у отмеченного варианта общее выделение',
    (_path, code) => {
      expect(/bestValueFrame\(|BEST_VALUE_BORDER/.test(code)).toBe(true);
    },
  );

  it.each(showcases.map((s) => [s.path, s.code]))(
    '%s: плашка не прижата вниз карточки',
    (_path, code) => {
      expect(/<BestValueBadge[^>]*className="[^"]*\bmt-/.test(code)).toBe(false);
    },
  );
});
