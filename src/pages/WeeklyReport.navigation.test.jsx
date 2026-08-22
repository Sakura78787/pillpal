import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import {
  WeeklyReportIntro,
  WeeklyReportUnavailable,
  weeklyReportReturnTarget,
  weeklyReportView,
} from './WeeklyReport.jsx';

describe('weekly report return navigation', () => {
  test('returns to care overview only when opened from care', () => {
    expect(weeklyReportReturnTarget('?from=care')).toBe('/care');
  });

  test('keeps the existing dashboard return target for all other entries', () => {
    expect(weeklyReportReturnTarget('')).toBe('/dashboard');
    expect(weeklyReportReturnTarget('?from=other')).toBe('/dashboard');
  });

  test('uses family-care semantics and the demo boundary only for care source', () => {
    const view = weeklyReportView('?from=care');
    const html = renderToStaticMarkup(<MemoryRouter><WeeklyReportIntro view={view} /></MemoryRouter>);

    expect(view.title).toBe('AI 家庭照护周报');
    expect(html).toContain('AI 家庭照护周报');
    expect(html).toContain('当前使用本人账号数据模拟异地子女只读照护视角');
    expect(html).toContain('尚未建立真实家庭账号绑定');
  });

  test('keeps ordinary weekly-report semantics without a family-binding claim', () => {
    const view = weeklyReportView('');
    const html = renderToStaticMarkup(<MemoryRouter><WeeklyReportIntro view={view} /></MemoryRouter>);

    expect(view.title).toBe('AI 用药管理周报');
    expect(html).toContain('AI 用药管理周报');
    expect(html).not.toMatch(/家庭照护|异地子女|家庭账号绑定/);
  });

  test('keeps disabled-state copy aligned with both entry sources', () => {
    const careHtml = renderToStaticMarkup(
      <MemoryRouter><WeeklyReportUnavailable view={weeklyReportView('?from=care')} onBack={vi.fn()} /></MemoryRouter>
    );
    const ordinaryHtml = renderToStaticMarkup(
      <MemoryRouter><WeeklyReportUnavailable view={weeklyReportView('')} onBack={vi.fn()} /></MemoryRouter>
    );

    expect(careHtml).toContain('AI 家庭照护周报暂未开启');
    expect(careHtml).toContain('尚未建立真实家庭账号绑定');
    expect(ordinaryHtml).toContain('AI 用药管理周报暂未开启');
    expect(ordinaryHtml).not.toMatch(/家庭照护|异地子女|家庭账号绑定/);
  });
});
