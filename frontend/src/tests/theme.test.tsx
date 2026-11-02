import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from '../context/ThemeContext';

const storageStub = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: storageStub,
});

let systemDark = false;
let listeners: Array<(event: MediaQueryListEvent) => void> = [];

function installMatchMedia() {
  systemDark = false;
  listeners = [];
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: systemDark,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.push(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners = listeners.filter((item) => item !== listener);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function Probe() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        Use dark
      </button>
      <button type="button" onClick={() => setTheme('system')}>
        Use system
      </button>
      <button type="button" onClick={toggleTheme}>
        Toggle
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    installMatchMedia();
    let meta = document.getElementById('theme-color');
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', '#f5f7f8');
  });

  it('defaults to the system preference and renders light without a saved choice', () => {
    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.getElementById('theme-color')).toHaveAttribute('content', '#f5f7f8');
  });

  it('persists an explicit theme and applies it to the document', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Use dark' }));

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.getElementById('theme-color')).toHaveAttribute('content', '#0b1115');
  });

  it('toggles to the opposite of the rendered theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('follows operating-system changes while set to system', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Use system' }));

    act(() => {
      systemDark = true;
      listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});
