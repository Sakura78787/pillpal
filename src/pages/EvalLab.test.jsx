import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import EvalLab from './EvalLab.jsx';

describe('EvalLab', () => {
  test('uses Chinese-facing copy for the interview lab page', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <EvalLab />
      </MemoryRouter>
    );

    expect(html).toContain('AI 评测实验室');
    expect(html).toContain('AI 评测实验室');
    expect(html).toContain('返回首页');
    expect(html).toContain('模型质量与工程可靠性分开评价');
    expect(html).not.toContain('Interview demo lab');
  });

  test('renders the committed V2 snapshot, manual review, and real bad cases', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <EvalLab />
      </MemoryRouter>
    );

    expect(html).toContain('Prompt V2');
    expect(html).toContain('95.8%');
    expect(html).toContain('固定抽检 12 例 + 额外 Bad Case 1 例');
    expect(html).toContain('v2-typical-4');
    expect(html).toContain('v2-care-3');
    expect(html).toContain('未通过');
  });
});
