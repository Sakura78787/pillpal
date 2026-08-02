import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import WeeklyReportEntryCard from './WeeklyReportEntryCard.jsx';

describe('WeeklyReportEntryCard', () => {
  test('renders nothing when disabled', () => {
    expect(renderToStaticMarkup(<WeeklyReportEntryCard enabled={false} />)).toBe('');
  });

  test('renders a link to the weekly report when enabled', () => {
    const html = renderToStaticMarkup(<WeeklyReportEntryCard enabled />);

    expect(html).toContain('/weekly-report');
    expect(html).toContain('AI 用药管理周报');
  });
});
