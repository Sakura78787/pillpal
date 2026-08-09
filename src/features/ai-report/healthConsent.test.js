import { describe, expect, test, vi } from 'vitest';
import { HEALTH_CONSENT_KEY, ensureHealthDataConsent } from './healthConsent.js';

const storage = () => {
  const values = new Map();
  return { getItem: vi.fn((key) => values.get(key) || null), setItem: vi.fn((key, value) => values.set(key, value)) };
};

describe('ensureHealthDataConsent', () => {
  test('asks once, stores an affirmative decision, and reuses it', () => {
    const localStorage = storage();
    const confirm = vi.fn(() => true);
    expect(ensureHealthDataConsent({ storage: localStorage, confirm })).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(HEALTH_CONSENT_KEY, 'granted');
    expect(ensureHealthDataConsent({ storage: localStorage, confirm })).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
  });

  test('does not store or grant consent when the user declines', () => {
    const localStorage = storage();
    expect(ensureHealthDataConsent({ storage: localStorage, confirm: () => false })).toBe(false);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
