import { describe, expect, test } from 'vitest';
import { canCreateAuthorization, normalizeCaregiverEmail, reminderDedupeKey } from '../functions/_shared/careAccess.ts';

describe('care access helpers', () => {
  test('normalizes an invited email and refuses self authorization', () => {
    expect(normalizeCaregiverEmail('  FAMILY@Example.COM ')).toBe('family@example.com');
    expect(canCreateAuthorization({ ownerEmail: 'owner@example.com', caregiverEmail: 'owner@example.com' })).toEqual({ ok: false, code: 'CARE_AUTHORIZATION_SELF_NOT_ALLOWED' });
  });

  test('rejects an invalid invited email without exposing account state', () => {
    expect(canCreateAuthorization({ ownerEmail: 'owner@example.com', caregiverEmail: 'invalid' })).toEqual({ ok: false, code: 'CARE_AUTHORIZATION_INVALID_EMAIL' });
  });

  test('uses one shared four-hour reminder key for every caregiver', () => {
    expect(reminderDedupeKey('recipient-1', new Date('2026-08-23T08:10:00.000Z')))
      .toBe('caregiver_medication_reminder:recipient-1:2026-08-23T08');
  });
});
