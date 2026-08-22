import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from './App.jsx';

describe('protected application routes', () => {
  test('routes /care through the authentication guard', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/care']}><AppRoutes /></MemoryRouter>
    );

    expect(html).toContain('加载中...');
    expect(html).not.toContain('开始使用');
  });
});
