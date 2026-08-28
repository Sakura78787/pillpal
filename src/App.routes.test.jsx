import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { isRouteAccessAllowed, AppRoutes } from './App.jsx';
import { AuthStatus } from '@/types/auth.js';

describe('protected application routes', () => {
  test('permits a guest only on explicitly enabled experience routes', () => {
    expect(isRouteAccessAllowed(AuthStatus.GUEST, true)).toBe(true);
    expect(isRouteAccessAllowed(AuthStatus.GUEST, false)).toBe(false);
    expect(isRouteAccessAllowed(AuthStatus.AUTHENTICATED, false)).toBe(true);
    expect(isRouteAccessAllowed(AuthStatus.UNAUTHENTICATED, true)).toBe(false);
  });

  test('routes /care through the authentication guard', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/care']}><AppRoutes /></MemoryRouter>
    );

    expect(html).toContain('加载中...');
    expect(html).not.toContain('开始使用');
  });
});
