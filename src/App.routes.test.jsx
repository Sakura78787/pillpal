import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { isRouteAccessAllowed, AppRoutes, GUEST_ACCESSIBLE_ROUTE_PATHS, isGuestAccessibleRoute } from './App.jsx';
import { AuthStatus } from '@/types/auth.js';

const renderRoute = (path) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>,
);

describe('protected application routes', () => {
  test('permits a guest only on explicitly enabled experience routes', () => {
    expect(isRouteAccessAllowed(AuthStatus.GUEST, true)).toBe(true);
    expect(isRouteAccessAllowed(AuthStatus.GUEST, false)).toBe(false);
    expect(isRouteAccessAllowed(AuthStatus.AUTHENTICATED, false)).toBe(true);
    expect(isRouteAccessAllowed(AuthStatus.UNAUTHENTICATED, true)).toBe(false);
  });

  test('routes /care through the authentication guard', () => {
    const html = renderRoute('/care');

    expect(html).toContain('加载中...');
    expect(html).not.toContain('开始使用');
  });

  test('keeps the visitor route matrix explicit and excludes account-only pages', () => {
    expect(GUEST_ACCESSIBLE_ROUTE_PATHS).toEqual([
      '/dashboard', '/medications', '/medications/add', '/medications/edit/:id',
      '/logs', '/appointments', '/inventory', '/health', '/profile', '/about', '/weekly-report', '/care',
    ]);
    ['/settings', '/profile/reminders', '/eval-lab'].forEach((path) => {
      expect(isGuestAccessibleRoute(path)).toBe(false);
      expect(isRouteAccessAllowed(AuthStatus.GUEST, isGuestAccessibleRoute(path))).toBe(false);
    });
  });
});
