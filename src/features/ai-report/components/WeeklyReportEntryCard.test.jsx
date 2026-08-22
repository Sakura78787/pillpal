import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import WeeklyReportEntryCard from './WeeklyReportEntryCard.jsx';

describe('WeeklyReportEntryCard', () => {
  test('keeps family care discoverable when AI is disabled', () => {
    const html = renderToStaticMarkup(<MemoryRouter><WeeklyReportEntryCard enabled={false} /></MemoryRouter>);

    expect(html).toContain('/care');
    expect(html).toContain('家人照护概览');
  });

  test('renders a link to the family care overview when enabled', () => {
    const html = renderToStaticMarkup(<MemoryRouter><WeeklyReportEntryCard enabled /></MemoryRouter>);

    expect(html).toContain('/care');
    expect(html).toContain('家人照护概览');
    expect(html).toContain('只读');
  });

  test('uses the client router Link instead of a document navigation anchor', () => {
    expect(WeeklyReportEntryCard().type).toBe(Link);
  });
});
