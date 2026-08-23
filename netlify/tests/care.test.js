import { describe, expect, test, vi } from 'vitest';
import { handleCareRequest } from '../functions/care.ts';

const request = (path, init = {}) => new Request(`https://pillpal.test${path}`, {
  ...init,
  headers: { authorization: 'Bearer token', 'content-type': 'application/json', ...(init.headers || {}) },
});

describe('care authorization API', () => {
  test('creates a pending authorization without revealing whether the email has an account', async () => {
    const insert = vi.fn(() => ({ error: null }));
    const admin = { from: vi.fn(() => ({ insert })) };
    const response = await handleCareRequest(request('/api/care/authorizations', {
      method: 'POST', body: JSON.stringify({ caregiverEmail: 'family@example.com' }),
    }), { params: {} }, {
      verifyUser: vi.fn(async () => ({ id: 'owner-1', email: 'owner@example.com' })),
      admin,
      now: () => new Date('2026-08-23T08:00:00Z'),
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: 'pending' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_user_id: 'owner-1', caregiver_email_normalized: 'family@example.com', status: 'pending',
    }));
  });
});
