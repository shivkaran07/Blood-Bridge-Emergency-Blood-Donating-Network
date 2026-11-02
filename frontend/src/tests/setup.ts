import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not implement scrollTo. The layouts call it on navigation.
window.scrollTo = vi.fn();

// Node 22+ exposes an experimental localStorage that throws unless the process
// is started with --localstorage-file, so provide an in-memory implementation.
function ensureLocalStorage() {
  try {
    if (window.localStorage) return;
  } catch {
    // Fall through and install the stub.
  }
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

ensureLocalStorage();

afterEach(() => {
  cleanup();
  window.scrollTo = vi.fn();
});
