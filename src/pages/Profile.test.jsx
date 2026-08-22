import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { ProfileMenu } from './Profile.jsx';

describe('ProfileMenu', () => {
  test('exposes family care as a discoverable entry', () => {
    const html = renderToStaticMarkup(<ProfileMenu navigate={vi.fn()} />);

    expect(html).toContain('家人照护');
    expect(html).toContain('只读查看最近 7 天照护信息');
    expect(html).toContain('href="/care"');
    expect(html).not.toContain('提醒 TA');
  });
});
