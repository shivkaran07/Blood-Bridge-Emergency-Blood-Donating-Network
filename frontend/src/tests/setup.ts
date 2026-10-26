import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not implement scrollTo. The layouts call it on navigation.
window.scrollTo = vi.fn();

afterEach(() => {
  cleanup();
  window.scrollTo = vi.fn();
});
