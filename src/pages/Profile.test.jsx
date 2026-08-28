import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { ProfileCareLink, ProfileMenu } from './Profile.jsx';

describe('ProfileMenu', () => {
  test('exposes family care as a discoverable entry', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ProfileMenu navigate={vi.fn()} /></MemoryRouter>);

    expect(html).toContain('家人照护');
    expect(html).toContain('只读查看最近 7 天照护信息');
    expect(html).toContain('href="/care"');
    expect(html).not.toContain('提醒 TA');
  });

  test('uses a client router Link for the family care item', () => {
    expect(ProfileCareLink().type).toBe(Link);
  });

  test('hides account-only data and reminder settings for visitors', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ProfileMenu navigate={vi.fn()} isGuest /></MemoryRouter>);

    expect(html).toContain('家人照护');
    expect(html).not.toContain('提醒设置');
    expect(html).not.toContain('数据管理');
  });
});
