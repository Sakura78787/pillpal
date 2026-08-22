import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('protected application routes', () => {
  test('registers the care overview behind ProtectedRoute', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

    expect(source).toMatch(/path="\/care"\s+element=\{<ProtectedRoute><CareOverview\s*\/><\/ProtectedRoute>\}/);
  });
});
