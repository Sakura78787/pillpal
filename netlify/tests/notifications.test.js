import { expect, test, vi } from 'vitest';
import { handleNotificationRequest } from '../functions/notifications.ts';

test('rejects a caregiver reminder when the relationship is not active', async () => {
  const response = await handleNotificationRequest(new Request('https://pillpal.test/api/notifications/remind', {
    method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify({ subjectUserId: 'owner-1' }),
  }), {
    verifyUser: vi.fn(async () => ({ id: 'caregiver-1' })), admin: {}, now: () => new Date(),
    hasAccess: vi.fn(async () => false),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ code: 'CARE_ACCESS_DENIED' });
});
