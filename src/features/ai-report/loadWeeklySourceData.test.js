import { describe, expect, test, vi } from 'vitest';
import { loadWeeklySourceData } from './loadWeeklySourceData.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function createQuery(table, result) {
  const calls = [];
  const chain = {
    select: vi.fn((...args) => {
      calls.push(['select', ...args]);
      return chain;
    }),
    eq: vi.fn((...args) => {
      calls.push(['eq', ...args]);
      return chain;
    }),
    is: vi.fn((...args) => {
      calls.push(['is', ...args]);
      return chain;
    }),
    gte: vi.fn((...args) => {
      calls.push(['gte', ...args]);
      return chain;
    }),
    lte: vi.fn((...args) => {
      calls.push(['lte', ...args]);
      return chain;
    }),
    order: vi.fn(async (...args) => {
      calls.push(['order', ...args]);
      return result;
    }),
  };
  return { table, calls, chain };
}

function createClient(resultsByTable) {
  const queries = {};
  const client = {
    from: vi.fn((table) => {
      queries[table] = createQuery(table, resultsByTable[table] || { data: [], error: null });
      return queries[table].chain;
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    rpc: vi.fn(),
  };
  return { client, queries };
}

describe('loadWeeklySourceData', () => {
  test('loads only the four read-only source tables with user and deleted filters', async () => {
    const { client, queries } = createClient({
      medications: { data: [{ id: 'med-1' }], error: null },
      medication_logs: { data: [{ id: 'log-1' }], error: null },
      health_records: { data: [{ id: 'health-1' }], error: null },
      appointments: { data: [{ id: 'appointment-1' }], error: null },
    });

    const data = await loadWeeklySourceData({ client, userId: 'user-1', now: NOW });

    expect(client.from).toHaveBeenCalledTimes(4);
    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      'medications',
      'medication_logs',
      'health_records',
      'appointments',
    ]);
    expect(data).toEqual({
      medications: [{ id: 'med-1' }],
      medicationLogs: [{ id: 'log-1' }],
      healthRecords: [{ id: 'health-1' }],
      appointments: [{ id: 'appointment-1' }],
    });

    for (const query of Object.values(queries)) {
      expect(query.calls).toContainEqual(['select', '*']);
      expect(query.calls).toContainEqual(['eq', 'user_id', 'user-1']);
      expect(query.calls).toContainEqual(['is', 'deleted_at', null]);
    }

    expect(queries.medication_logs.calls).toContainEqual(['gte', 'scheduled_date', '2026-07-27']);
    expect(queries.medication_logs.calls).toContainEqual(['lte', 'scheduled_date', '2026-08-02']);
    expect(queries.health_records.calls).toContainEqual(['gte', 'recorded_at', '2026-07-27T00:00:00.000Z']);
    expect(queries.health_records.calls).toContainEqual(['lte', 'recorded_at', '2026-08-02T23:59:59.999Z']);
    expect(queries.appointments.calls).toContainEqual(['eq', 'status', 'scheduled']);
    expect(queries.appointments.calls).toContainEqual(['gte', 'appointment_date', '2026-08-02']);
    expect(queries.appointments.calls).toContainEqual(['lte', 'appointment_date', '2026-08-16']);

    expect(client.insert).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
    expect(client.upsert).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  test('fails the whole load when one query fails', async () => {
    const { client } = createClient({
      medications: { data: [], error: null },
      medication_logs: { data: null, error: { message: 'logs unavailable' } },
      health_records: { data: [], error: null },
      appointments: { data: [], error: null },
    });

    await expect(loadWeeklySourceData({ client, userId: 'user-1', now: NOW })).rejects.toThrow(
      'logs unavailable'
    );
  });
});
