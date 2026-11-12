// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorySeries } from './types';

/**
 * Жалоба владельца 12.11: «при последней странице и перелистывании вправо — не
 * должно переходить на сторис по другой теме». История — одна тема: вперёд с
 * последней страницы закрывает её, назад с первой никуда не уводит, таймер на
 * последней странице останавливается.
 *
 * Второе, что здесь закреплено: касание закрывает историю на click, а не на
 * pointerup. Иначе слой пропадает раньше click того же касания, и click
 * достаётся главной под ним — открывается ссылка, оказавшаяся под пальцем.
 */

const navigate = vi.fn();

vi.mock('react-router', () => ({ useNavigate: () => navigate }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      const text = typeof fallback === 'string' ? fallback : key;
      return opts ? text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(opts[name])) : text;
    },
  }),
}));

vi.mock('@/hooks/useBranding', () => ({
  useBranding: () => ({
    appName: 'Spofy VPN',
    logoUrl: null,
    hasCustomLogo: false,
    logoLetter: 'S',
  }),
}));

vi.mock('@/hooks/useHeaderHeight', () => ({
  useHeaderHeight: () => ({ topSafeArea: 0, bottomSafeArea: 0 }),
}));

vi.mock('./visuals', () => ({ StoryVisual: () => null }));

vi.mock('./registry', async (original) => {
  const actual = await original<typeof import('./registry')>();
  const meta = (id: string) => actual.STORY_SERIES.find((s) => s.id === id)!;
  const slidesOf = (name: string, count: number, cta: string) =>
    Array.from({ length: count }, (_, i) => ({
      title: `${name} ${i + 1}`,
      subtitle: '…',
      ...(i === count - 1 ? { ctaLabel: cta } : {}),
    }));
  const series: StorySeries[] = [
    {
      meta: meta('connect'),
      coverTitle: 'Как подключить',
      slides: slidesOf('connect', 3, 'Подключить'),
    },
    {
      meta: meta('appstore-region'),
      coverTitle: 'Нет INCY в App Store',
      slides: slidesOf('region', 5, 'Подключить'),
    },
    {
      meta: meta('no-connection'),
      coverTitle: 'VPN не работает',
      slides: slidesOf('fix', 5, 'Написать в поддержку'),
    },
  ];
  return { ...actual, useStorySeries: () => series };
});

import { StoryViewer } from './StoryViewer';

if (!('ResizeObserver' in window)) {
  Object.assign(window, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
}

const SLIDE_MS = 8000;
const WIDTH = 300;

const topic = () => document.querySelector('.story-header-series')?.textContent ?? null;
const step = () => document.querySelector('.story-step')?.textContent ?? null;
const title = () => document.querySelector('.story-title')?.textContent ?? null;
const layer = () => document.querySelector('.story-slide') as HTMLElement;

function open(index: number) {
  const onClose = vi.fn();
  render(<StoryViewer initialIndex={index} onClose={onClose} />);
  // jsdom не считает раскладку: задаём ширину слоя, чтобы работали зоны касания.
  layer().getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: WIDTH,
      height: 600,
      right: WIDTH,
      bottom: 600,
      x: 0,
      y: 0,
    }) as DOMRect;
  return onClose;
}

/** Касание: палец опустили и подняли в одной точке. Click браузер шлёт следом. */
function press(x: number) {
  fireEvent.pointerDown(layer(), { clientX: x, clientY: 300 });
  fireEvent.pointerUp(layer(), { clientX: x, clientY: 300 });
}
function tap(x: number) {
  press(x);
  fireEvent.click(layer(), { clientX: x, clientY: 300 });
}
const tapForward = () => tap(WIDTH * 0.8);
const tapBack = () => tap(WIDTH * 0.1);

function swipe(dx: number) {
  fireEvent.pointerDown(layer(), { clientX: 150, clientY: 300 });
  fireEvent.pointerMove(layer(), { clientX: 150 + dx, clientY: 300 });
  if (document.querySelector('.story-slide')) {
    fireEvent.pointerUp(layer(), { clientX: 150 + dx, clientY: 300 });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  navigate.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StoryViewer: листание внутри одной темы', () => {
  it('касание справа листает страницы открытой темы', () => {
    open(0);
    expect([topic(), step(), title()]).toEqual(['Как подключить', 'Шаг 1 из 3', 'connect 1']);
    tapForward();
    expect([topic(), step()]).toEqual(['Как подключить', 'Шаг 2 из 3']);
    tapForward();
    expect([topic(), step()]).toEqual(['Как подключить', 'Шаг 3 из 3']);
  });

  it('с последней страницы касание справа закрывает историю, а не открывает соседнюю тему', () => {
    const onClose = open(0);
    tapForward();
    tapForward();
    tapForward();
    expect(onClose).toHaveBeenCalledTimes(1);
    // Просмотрщик до закрытия так и остался на своей теме.
    expect(topic()).toBe('Как подключить');
    expect(step()).toBe('Шаг 3 из 3');
  });

  it('так у любой темы, не только у первой', () => {
    for (const [index, name, pages] of [
      [1, 'Нет INCY в App Store', 5],
      [2, 'VPN не работает', 5],
    ] as const) {
      const onClose = open(index);
      for (let i = 1; i < pages; i += 1) tapForward();
      expect([topic(), step()]).toEqual([name, `Шаг ${pages} из ${pages}`]);
      tapForward();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(topic()).toBe(name);
      cleanup();
    }
  });

  it('свайп вперёд на последней странице тоже закрывает', () => {
    const onClose = open(0);
    tapForward();
    tapForward();
    swipe(-120);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(topic()).toBe('Как подключить');
  });

  it('с первой страницы «назад» не уводит в предыдущую тему', () => {
    const onClose = open(1);
    tapBack();
    expect([topic(), step()]).toEqual(['Нет INCY в App Store', 'Шаг 1 из 5']);
    swipe(120);
    expect([topic(), step()]).toEqual(['Нет INCY в App Store', 'Шаг 1 из 5']);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«назад» внутри темы возвращает на предыдущую страницу', () => {
    open(1);
    tapForward();
    tapForward();
    tapBack();
    expect([topic(), step()]).toEqual(['Нет INCY в App Store', 'Шаг 2 из 5']);
  });

  it('клавиши: → на последней закрывает, ← на первой остаётся', () => {
    const onClose = open(0);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect([topic(), step()]).toEqual(['Как подключить', 'Шаг 1 из 3']);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(step()).toBe('Шаг 3 из 3');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('StoryViewer: таймер', () => {
  it('сам листает страницы темы и останавливается на последней', () => {
    const onClose = open(0);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS + 200);
    });
    expect(step()).toBe('Шаг 2 из 3');
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS + 200);
    });
    expect(step()).toBe('Шаг 3 из 3');
    // Минута на последней странице: не закрылась и не ушла в другую тему.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect([topic(), step()]).toEqual(['Как подключить', 'Шаг 3 из 3']);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('StoryViewer: касание не проваливается на главную', () => {
  it('история закрывается на click, а не на отпускании пальца', () => {
    const onClose = open(0);
    tapForward();
    tapForward();
    press(WIDTH * 0.8);
    // Палец подняли — слой ещё на месте и примет click этого касания сам.
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.story-viewer')).not.toBeNull();
    fireEvent.click(layer(), { clientX: WIDTH * 0.8, clientY: 300 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('долгое удержание — пауза, а не листание', () => {
    const onClose = open(0);
    fireEvent.pointerDown(layer(), { clientX: 240, clientY: 300 });
    act(() => {
      vi.advanceTimersByTime(900);
    });
    fireEvent.pointerUp(layer(), { clientX: 240, clientY: 300 });
    fireEvent.click(layer(), { clientX: 240, clientY: 300 });
    expect(step()).toBe('Шаг 1 из 3');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('click без касания по слою (например, от кнопки) ничего не листает', () => {
    const onClose = open(0);
    fireEvent.click(layer(), { clientX: 240, clientY: 300 });
    expect(step()).toBe('Шаг 1 из 3');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('кнопка на последней странице закрывает историю и ведёт по своему адресу', () => {
    const onClose = open(2);
    for (let i = 1; i < 5; i += 1) tapForward();
    const cta = document.querySelector('.story-cta') as HTMLButtonElement;
    expect(cta.textContent).toBe('Написать в поддержку');
    fireEvent.click(cta);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/support');
  });
});
