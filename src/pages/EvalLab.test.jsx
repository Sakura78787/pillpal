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
    expect(html).not.toContain('Interview demo lab');
  });
});
