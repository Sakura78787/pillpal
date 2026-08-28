import { describe, expect, test } from 'vitest';
import {
  GUEST_SESSION_STORAGE_KEY,
  GUEST_USER_ID,
  createGuestSessionRepository,
} from './guestSession.js';

const NOW = new Date('2026-08-27T09:00:00.000Z');

const createStorage = ({ failWrites = false } = {}) => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrites) throw new Error('storage unavailable');
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
};

describe('guest session repository', () => {
  test('creates an editable, date-relative synthetic session for a first-time visitor', () => {
    const storage = createStorage();
    const repository = createGuestSessionRepository({ storage, now: () => NOW });

    const result = repository.read();

    expect(result.persistence).toBe('session');
    expect(result.session.userId).toBe(GUEST_USER_ID);
    expect(result.session.medications).toHaveLength(2);
    expect(result.session.medications.every((item) => item.is_guest && !item.is_demo)).toBe(true);
    expect(result.session.appointments[0].appointment_date).toBe('2026-09-02');
    expect(storage.getItem(GUEST_SESSION_STORAGE_KEY)).not.toBeNull();
  });

  test('rehydrates a mutation from the current tab session after a refresh', () => {
    const storage = createStorage();
    const firstRepository = createGuestSessionRepository({ storage, now: () => NOW });
    const initial = firstRepository.read().session;

    const write = firstRepository.replace({
      ...initial,
      medications: [...initial.medications, {
        ...initial.medications[0],
        id: 'guest-medication-custom',
        name: '访客新增药物',
      }],
    });

    const refreshedRepository = createGuestSessionRepository({ storage, now: () => NOW });
    const refreshed = refreshedRepository.read();

    expect(write.success).toBe(true);
    expect(refreshed.session.medications.map((item) => item.name)).toContain('访客新增药物');
    expect(refreshed.persistence).toBe('session');
  });

  test('replaces a malformed stored payload with a safe synthetic session', () => {
    const storage = createStorage();
    storage.setItem(GUEST_SESSION_STORAGE_KEY, '{not-json');
    const repository = createGuestSessionRepository({ storage, now: () => NOW });

    const result = repository.read();

    expect(result.recovered).toBe(true);
    expect(result.session.userId).toBe(GUEST_USER_ID);
    expect(result.session.medications).toHaveLength(2);
  });

  test('resets the current visitor changes back to the synthetic seed', () => {
    const storage = createStorage();
    const repository = createGuestSessionRepository({ storage, now: () => NOW });
    const initial = repository.read().session;
    repository.replace({ ...initial, medications: [] });

    const reset = repository.reset();

    expect(reset.success).toBe(true);
    expect(reset.session.medications).toHaveLength(2);
  });

  test('continues in memory when session storage cannot be written', () => {
    const storage = createStorage();
    const repository = createGuestSessionRepository({ storage, now: () => NOW });
    const initial = repository.read();
    storage.setItem = () => { throw new Error('storage unavailable'); };

    const write = repository.replace({ ...initial.session, healthRecords: [] });

    expect(initial.persistence).toBe('session');
    expect(write.persistence).toBe('memory');
    expect(write.success).toBe(true);
    expect(repository.read().persistence).toBe('memory');
    expect(repository.read().session.healthRecords).toEqual([]);
  });

  test('rejects snapshots beyond the visitor experience limit', () => {
    const storage = createStorage();
    const repository = createGuestSessionRepository({ storage, now: () => NOW });
    const initial = repository.read().session;
    const oversized = Array.from({ length: 51 }, (_, index) => ({
      ...initial.medications[0],
      id: `guest-medication-${index}`,
    }));

    const write = repository.replace({ ...initial, medications: oversized });

    expect(write).toMatchObject({ success: false, error: '访客体验用药计划已达上限，请重置体验或登录后继续。' });
  });
});
