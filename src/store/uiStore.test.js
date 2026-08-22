import { afterEach, describe, expect, test, vi } from 'vitest';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

afterEach(() => {
  vi.resetModules();
  if (navigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  } else {
    delete globalThis.navigator;
  }
});

describe('uiStore server-safe initialization', () => {
  test('defaults to online when navigator is unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
    });
    vi.resetModules();

    const { useUIStore } = await import('./uiStore.js');

    expect(useUIStore.getState().isOnline).toBe(true);
  });
});
