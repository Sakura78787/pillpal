import { describe, expect, test } from 'vitest';
import { createGuestSessionRepository } from './guestSession.js';
import { createGuestDataGateway } from './guestData.js';

const NOW = new Date('2026-08-27T09:00:00.000Z');

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

describe('guest data gateway', () => {
  test('creates an editable visitor medication and keeps the guest ownership marker', () => {
    const gateway = createGuestDataGateway({
      repository: createGuestSessionRepository({ storage: createStorage(), now: () => NOW }),
      now: () => NOW,
      createId: () => 'guest-medication-new',
    });

    const created = gateway.create('medications', { name: '访客新增药物', status: 'active' });

    expect(created).toMatchObject({
      success: true,
      data: { id: 'guest-medication-new', name: '访客新增药物', is_guest: true, is_demo: false },
    });
    expect(gateway.list('medications').some((item) => item.id === 'guest-medication-new')).toBe(true);
  });

  test('updates and filters a visitor collection without changing other entities', () => {
    const repository = createGuestSessionRepository({ storage: createStorage(), now: () => NOW });
    const gateway = createGuestDataGateway({ repository, now: () => NOW, createId: () => 'guest-health-new' });
    const original = gateway.list('healthRecords')[0];

    const updated = gateway.update('healthRecords', original.id, { note: '已修改的访客记录' });
    const filtered = gateway.list('healthRecords', (item) => item.note === '已修改的访客记录');

    expect(updated).toMatchObject({ success: true, data: { id: original.id, note: '已修改的访客记录' } });
    expect(filtered).toHaveLength(1);
    expect(gateway.list('medications')).toHaveLength(2);
  });

  test('returns a controlled error for an unknown visitor entity', () => {
    const gateway = createGuestDataGateway({
      repository: createGuestSessionRepository({ storage: createStorage(), now: () => NOW }),
      now: () => NOW,
    });

    expect(gateway.update('appointments', 'missing-id', { status: 'cancelled' }))
      .toEqual({ success: false, error: '访客体验数据不存在或已重置。' });
  });
});
