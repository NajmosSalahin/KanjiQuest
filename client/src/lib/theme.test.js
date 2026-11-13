import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyTheme, initTheme, resolveTheme, watchSystemTheme } from './theme.js';

function stubSystemTheme(dark) {
  const listeners = new Set();
  const media = {
    matches: dark,
    addEventListener: (type, listener) => listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media)
  );
  return { media, listeners };
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme preference (§6.13)', () => {
  it('resolves explicit preferences without consulting the OS', () => {
    stubSystemTheme(true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('applies the resolved theme and remembers the preference', () => {
    stubSystemTheme(false);
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('kg_theme')).toBe('dark');

    applyTheme('auto');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('kg_theme')).toBe('auto');
  });

  it('boots from the cached preference', () => {
    stubSystemTheme(false);
    window.localStorage.setItem('kg_theme', 'dark');
    initTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('watches OS changes while the preference is auto', () => {
    const { listeners } = stubSystemTheme(true);
    const onChange = vi.fn();
    const unsubscribe = watchSystemTheme(onChange);

    expect(resolveTheme('auto')).toBe('dark');
    expect(listeners.size).toBe(1);
    for (const listener of listeners) listener();
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(listeners.size).toBe(0);
  });
});
