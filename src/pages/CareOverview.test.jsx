import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { CareOverviewContent } from './CareOverview.jsx';

const overview = {
  periodStart: '2026-07-29',
  periodEnd: '2026-08-04',
  metrics: {
    due: 7,
    taken: 4,
    skipped: 1,
    unrecorded: 2,
    lowStock: 1,
    healthRecords: 3,
    nextAppointmentInDays: 2,
  },
  actions: [
    { code: 'low_stock', level: 'action', title: '1 种药品库存偏低', description: '建议核对库存。' },
    { code: 'unrecorded_doses', level: 'attention', title: '2 次记录待确认', description: '待确认实际情况。' },
  ],
};

const renderContent = (props) => renderToStaticMarkup(<CareOverviewContent {...props} />);

describe('CareOverviewContent', () => {
  test('shows the demo boundary, core metrics, ordered actions, and AI entry', () => {
    const html = renderContent({ overview, aiEnabled: true });

    expect(html).toContain('当前使用本人账号数据模拟异地子女只读照护视角');
    expect(html).toContain('尚未建立真实家庭账号绑定');
    expect(html).toContain('计划剂次');
    expect(html).toContain('已记录服用');
    expect(html).toContain('明确跳过');
    expect(html).toContain('未记录');
    expect(html).toContain('低库存药品');
    expect(html).toContain('健康记录');
    expect(html).toContain('复诊倒计时');
    expect(html.indexOf('1 种药品库存偏低')).toBeLessThan(html.indexOf('2 次记录待确认'));
    expect(html).toContain('/weekly-report?from=care');
    expect(html).toContain('生成 AI 家庭照护周报');
    expect(html).not.toMatch(/打卡|编辑药物|修改健康数据|提醒 TA|真实家庭账号已绑定/);
  });

  test('renders loading and query failure states', () => {
    const loadingHtml = renderContent({ loading: true, aiEnabled: true });
    const errorHtml = renderContent({ error: '读取照护数据失败', aiEnabled: true });

    expect(loadingHtml).toContain('正在整理最近 7 天照护信息');
    expect(errorHtml).toContain('读取照护数据失败');
    expect(loadingHtml).toContain('尚未建立真实家庭账号绑定');
    expect(errorHtml).toContain('尚未建立真实家庭账号绑定');
  });

  test('renders no-plan and no-health states without medical inference', () => {
    const html = renderContent({
      overview: {
        ...overview,
        metrics: { ...overview.metrics, due: 0, taken: 0, skipped: 0, unrecorded: 0, healthRecords: 0 },
        actions: [{ code: 'no_health_records', level: 'info', title: '近 7 天暂无健康记录', description: '当前信息不足。' }],
      },
      aiEnabled: true,
    });

    expect(html).toContain('近 7 天没有可汇总的用药计划剂次');
    expect(html).toContain('近 7 天暂无健康记录');
    expect(html).not.toMatch(/健康异常|病情|漏服/);
  });

  test('keeps the overview available while disabling only the AI action', () => {
    const html = renderContent({ overview, aiEnabled: false });

    expect(html).toContain('计划剂次');
    expect(html).toContain('AI 家庭照护周报暂未开启');
    expect(html).not.toContain('/weekly-report?from=care');
  });
});
