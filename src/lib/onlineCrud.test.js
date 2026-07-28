import { describe, expect, it } from 'vitest';
import { assertUserId, cleanMutationPayload } from './onlineCrud';

describe('online CRUD migration helpers', () => {
  it('removes local-only fields before sending data to Supabase', () => {
    expect(
      cleanMutationPayload({
        id: 1,
        user_id: 'user-1',
        name: 'Aspirin',
        stock_quantity: 10,
        is_demo: true,
        synced_at: '2026-01-01T00:00:00.000Z',
        _time: '08:00',
        note: '',
        deleted_at: null,
        undefined_field: undefined,
      })
    ).toEqual({
      user_id: 'user-1',
      name: 'Aspirin',
      stock_quantity: 10,
      note: '',
      deleted_at: null,
    });
  });

  it('throws a clear error when a write has no authenticated user id', () => {
    expect(() => assertUserId('')).toThrow('请先登录');
    expect(() => assertUserId(null)).toThrow('请先登录');
  });
});
