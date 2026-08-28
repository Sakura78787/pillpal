import { z } from 'zod';
import { toLocalDateKey } from '@/lib/dateTime';

export const GUEST_USER_ID = 'pillpal-guest-session';
export const GUEST_SESSION_STORAGE_KEY = 'pillpal_guest_session_v1';
export const GUEST_SESSION_VERSION = 1;

export const GUEST_SESSION_LIMITS = {
  medications: 50,
  medicationLogs: 500,
  healthRecords: 200,
  appointments: 50,
  bytes: 1024 * 1024,
};

const entitySchema = z.object({ id: z.string().min(1) }).passthrough();
const guestSessionInputSchema = z.object({
  version: z.literal(GUEST_SESSION_VERSION),
  userId: z.literal(GUEST_USER_ID),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  medications: z.array(entitySchema),
  medicationLogs: z.array(entitySchema),
  healthRecords: z.array(entitySchema),
  appointments: z.array(entitySchema),
});

const guestSessionSchema = guestSessionInputSchema.extend({
  medications: z.array(entitySchema).max(GUEST_SESSION_LIMITS.medications),
  medicationLogs: z.array(entitySchema).max(GUEST_SESSION_LIMITS.medicationLogs),
  healthRecords: z.array(entitySchema).max(GUEST_SESSION_LIMITS.healthRecords),
  appointments: z.array(entitySchema).max(GUEST_SESSION_LIMITS.appointments),
});

export const isGuestUserId = (userId) => userId === GUEST_USER_ID;
export const isGuestEntityId = (entityId) => String(entityId || '').startsWith('guest-');

const clone = (value) => JSON.parse(JSON.stringify(value));

const localDateAfter = (now, amount) => {
  const next = new Date(now);
  next.setDate(next.getDate() + amount);
  return toLocalDateKey(next);
};

const guestEntity = (item) => ({
  ...item,
  user_id: GUEST_USER_ID,
  is_guest: true,
  is_demo: false,
});

export const createGuestEntityId = (type) => {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `guest-${type}-${suffix}`;
};

export const createGuestSession = (now = new Date()) => {
  const createdAt = now.toISOString();
  const medicationOne = guestEntity({
    id: 'guest-medication-lipid',
    name: '示例降脂药',
    dosage: '1',
    unit: '片',
    frequency_type: 'daily',
    frequency_config: { dailyTimes: 1 },
    reminder_times: ['08:00'],
    meal_timing: 'after_meal',
    start_date: localDateAfter(now, -6),
    end_date: null,
    stock_quantity: 12,
    stock_unit: '片',
    low_stock_threshold: 7,
    status: 'active',
    notes: '访客体验用合成数据，请勿输入真实处方信息。',
    created_at: createdAt,
    updated_at: createdAt,
  });
  const medicationTwo = guestEntity({
    id: 'guest-medication-pressure',
    name: '示例血压药',
    dosage: '1',
    unit: '片',
    frequency_type: 'daily',
    frequency_config: { dailyTimes: 1 },
    reminder_times: ['20:00'],
    meal_timing: 'after_meal',
    start_date: localDateAfter(now, -6),
    end_date: null,
    stock_quantity: 5,
    stock_unit: '片',
    low_stock_threshold: 7,
    status: 'active',
    notes: '访客体验用合成数据，请勿输入真实处方信息。',
    created_at: createdAt,
    updated_at: createdAt,
  });

  const medicationLogs = Array.from({ length: 7 }, (_, index) => {
    const dayOffset = -index;
    const scheduledDate = localDateAfter(now, dayOffset);
    const status = index === 2 ? 'skipped' : 'taken';
    return guestEntity({
      id: `guest-log-lipid-${scheduledDate}`,
      medication_id: medicationOne.id,
      scheduled_date: scheduledDate,
      scheduled_time: '08:00',
      taken_at: status === 'taken' ? new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000).toISOString() : null,
      status,
      skip_reason: status === 'skipped' ? '访客体验示例' : null,
      feeling_score: null,
      note: '',
      created_at: createdAt,
    });
  });

  const healthRecords = [
    guestEntity({
      id: 'guest-health-pressure',
      record_type: 'blood_pressure',
      values: { systolic: 126, diastolic: 80, heart_rate: 72 },
      recorded_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      note: '访客体验示例',
      created_at: createdAt,
    }),
    guestEntity({
      id: 'guest-health-weight',
      record_type: 'weight',
      values: { value: 65.2, height: 170, bmi: 22.6 },
      recorded_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      note: '访客体验示例',
      created_at: createdAt,
    }),
  ];

  return {
    version: GUEST_SESSION_VERSION,
    userId: GUEST_USER_ID,
    createdAt,
    updatedAt: createdAt,
    medications: [medicationOne, medicationTwo],
    medicationLogs,
    healthRecords,
    appointments: [guestEntity({
      id: 'guest-appointment-follow-up',
      hospital_name: '示例医院',
      department: '心内科',
      doctor_name: '示例医生',
      appointment_date: localDateAfter(now, 6),
      appointment_time: '09:00',
      is_first_visit: false,
      status: 'scheduled',
      checkup_items: ['示例检查项目'],
      prescription: {},
      reminder_days: 3,
      notes: '访客体验示例',
      created_at: createdAt,
      updated_at: createdAt,
    })],
  };
};

const normalizeSession = (session, now) => {
  const candidate = {
    ...clone(session),
    version: GUEST_SESSION_VERSION,
    userId: GUEST_USER_ID,
    updatedAt: now.toISOString(),
  };
  ['medications', 'medicationLogs', 'healthRecords', 'appointments'].forEach((collection) => {
    candidate[collection] = (candidate[collection] || []).map(guestEntity);
  });
  return candidate;
};

const sizeInBytes = (value) => {
  const serialized = JSON.stringify(value);
  return globalThis.TextEncoder ? new TextEncoder().encode(serialized).length : serialized.length;
};

const limitError = (session) => {
  if (session.medications.length > GUEST_SESSION_LIMITS.medications) {
    return '访客体验用药计划已达上限，请重置体验或登录后继续。';
  }
  if (session.medicationLogs.length > GUEST_SESSION_LIMITS.medicationLogs) {
    return '访客体验服药记录已达上限，请重置体验或登录后继续。';
  }
  if (session.healthRecords.length > GUEST_SESSION_LIMITS.healthRecords) {
    return '访客体验健康记录已达上限，请重置体验或登录后继续。';
  }
  if (session.appointments.length > GUEST_SESSION_LIMITS.appointments) {
    return '访客体验复诊预约已达上限，请重置体验或登录后继续。';
  }
  if (sizeInBytes(session) > GUEST_SESSION_LIMITS.bytes) {
    return '访客体验数据量已达上限，请重置体验或登录后继续。';
  }
  return '';
};

const parseStoredSession = (stored) => {
  if (!stored) return null;
  try {
    const parsed = guestSessionSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const createGuestSessionRepository = ({ storage = null, now = () => new Date() } = {}) => {
  let memorySession = null;
  let persistence = storage ? 'session' : 'memory';

  const persist = (session) => {
    memorySession = clone(session);
    if (!storage) {
      persistence = 'memory';
      return;
    }
    try {
      storage.setItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(session));
      persistence = 'session';
    } catch {
      persistence = 'memory';
    }
  };

  const createAndPersistSeed = () => {
    const session = createGuestSession(now());
    persist(session);
    return session;
  };

  const read = () => {
    if (memorySession) return { session: clone(memorySession), persistence, recovered: false };
    let stored = null;
    let storageReadFailed = false;
    if (storage) {
      try {
        stored = storage.getItem(GUEST_SESSION_STORAGE_KEY);
      } catch {
        storageReadFailed = true;
      }
    }
    const parsed = parseStoredSession(stored);
    if (parsed) {
      memorySession = clone(parsed);
      persistence = storageReadFailed ? 'memory' : 'session';
      return { session: clone(memorySession), persistence, recovered: false };
    }
    const session = createAndPersistSeed();
    return { session: clone(session), persistence, recovered: Boolean(stored || storageReadFailed) };
  };

  const hasSession = () => {
    if (memorySession) return true;
    if (!storage) return false;
    try {
      const stored = storage.getItem(GUEST_SESSION_STORAGE_KEY);
      const parsed = parseStoredSession(stored);
      if (parsed) memorySession = clone(parsed);
      return Boolean(stored);
    } catch {
      return false;
    }
  };

  const replace = (session) => {
    const normalized = normalizeSession(session, now());
    const parsed = guestSessionInputSchema.safeParse(normalized);
    if (!parsed.success) return { success: false, error: '访客体验数据格式无效，请重置体验后重试。' };
    const error = limitError(parsed.data);
    if (error) return { success: false, error };
    persist(parsed.data);
    return { success: true, session: clone(parsed.data), persistence };
  };

  const reset = () => {
    const session = createGuestSession(now());
    persist(session);
    return { success: true, session: clone(session), persistence };
  };

  const clear = () => {
    memorySession = null;
    if (storage) {
      try {
        storage.removeItem(GUEST_SESSION_STORAGE_KEY);
      } catch {
        persistence = 'memory';
      }
    }
    return { success: true };
  };

  return { read, hasSession, replace, reset, clear };
};

const browserSessionStorage = () => {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
};

export const guestSessionRepository = createGuestSessionRepository({ storage: browserSessionStorage() });
