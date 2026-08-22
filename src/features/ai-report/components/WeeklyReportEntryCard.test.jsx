import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import WeeklyReportEntryCard from './WeeklyReportEntryCard.jsx';

describe('WeeklyReportEntryCard', () => {
  test('keeps family care discoverable when AI is disabled', () => {
    const html = renderToStaticMarkup(<WeeklyReportEntryCard enabled={false} />);

    expect(html).toContain('/care');
    expect(html).toContain('家人照护概览');
  });

  test('renders a link to the family care overview when enabled', () => {
    const html = renderToStaticMarkup(<WeeklyReportEntryCard enabled />);

    expect(html).toContain('/care');
    expect(html).toContain('家人照护概览');
    expect(html).toContain('只读');
  });
});
