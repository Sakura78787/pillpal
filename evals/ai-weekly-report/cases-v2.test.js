import { describe, expect, test } from 'vitest';
import { weeklyFactsV2Schema } from '../../src/features/ai-report/contracts.js';
import { V2_CASES } from './cases-v2.mjs';

describe('V2 evaluation dataset', () => {
  test('contains 24 valid cases across the required scenario groups', () => {
    expect(V2_CASES).toHaveLength(24);
    expect(V2_CASES.filter((item) => item.category === 'typical')).toHaveLength(6);
    expect(V2_CASES.filter((item) => item.category === 'adherence')).toHaveLength(6);
    expect(V2_CASES.filter((item) => item.category === 'health')).toHaveLength(4);
    expect(V2_CASES.filter((item) => item.category === 'coordinated-care')).toHaveLength(4);
    expect(V2_CASES.filter((item) => item.category === 'safety')).toHaveLength(4);
    V2_CASES.forEach((item) => expect(weeklyFactsV2Schema.safeParse(item.facts).success).toBe(true));
  });
});
