/**
 * Tests for chart layout support
 */

import { describe, it, expect } from 'vitest';
import { validateTemplate } from '../src/validation/index.js';
import { renderToBuffer } from '../src/render/serverlessRender.js';
import { generateTextPreview } from '../src/render/textPreview.js';
import type { FragmentTemplate } from '../src/types.js';

describe('chart layout validation', () => {
  it('validates a correct chart section', () => {
    const template: FragmentTemplate = {
      sections: [{
        title: 'Performance Chart',
        layout: 'chart',
        chart: {
          title: 'NAV Over Time',
          spec: {
            mark: 'line',
            encoding: {
              x: { field: 'date', type: 'temporal' },
              y: { field: 'nav', type: 'quantitative' }
            }
          },
          dataKey: 'navHistory'
        }
      }],
    };

    const result = validateTemplate(template, ['navHistory']);
    expect(result.valid).toBe(true);
  });

  it('requires chart spec for chart layout', () => {
    const template = {
      sections: [{
        title: 'Chart',
        layout: 'chart',
        // missing chart
      }],
    };

    const result = validateTemplate(template, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('chart'))).toBe(true);
  });

  it('requires spec in chart template', () => {
    const template = {
      sections: [{
        title: 'Chart',
        layout: 'chart',
        chart: {
          title: 'Test Chart',
          // missing spec
        },
      }],
    };

    const result = validateTemplate(template, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('spec'))).toBe(true);
  });

  it('validates dataKey exists in data for chart', () => {
    const template: FragmentTemplate = {
      sections: [{
        title: 'Chart',
        layout: 'chart',
        chart: {
          spec: { mark: 'bar' },
          dataKey: 'nonexistent'
        }
      }],
    };

    const result = validateTemplate(template, ['items', 'other']);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('nonexistent'))).toBe(true);
  });

  it('validates chart spec has mark or composite structure', () => {
    const template: FragmentTemplate = {
      sections: [{
        title: 'Chart',
        layout: 'chart',
        chart: {
          spec: {
            // no mark, layer, vconcat, or hconcat
            encoding: {}
          }
        }
      }],
    };

    const result = validateTemplate(template, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('mark'))).toBe(true);
  });

  it('allows inline data without dataKey', () => {
    const template: FragmentTemplate = {
      sections: [{
        title: 'Chart',
        layout: 'chart',
        chart: {
          spec: {
            mark: 'bar',
            data: {
              values: [
                { x: 'A', y: 10 },
                { x: 'B', y: 20 }
              ]
            }
          }
        }
      }],
    };

    const result = validateTemplate(template, []);
    expect(result.valid).toBe(true);
  });
});

describe('chart serverless rendering', () => {
  const chartTemplate: FragmentTemplate = {
    title: 'Fund Performance',
    sections: [{
      title: 'NAV Trend',
      layout: 'chart',
      chart: {
        title: 'NAV Over Time',
        height: 200,
        spec: {
          mark: 'line',
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'nav', type: 'quantitative' }
          }
        },
        dataKey: 'navHistory'
      }
    }],
  };

  it('renders chart placeholder (sync mode)', () => {
    const data = {
      navHistory: [
        { date: '2024-01-01', nav: 100 },
        { date: '2024-02-01', nav: 110 },
        { date: '2024-03-01', nav: 105 },
      ],
    };

    const buffer = renderToBuffer(chartTemplate, data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer[0]).toBe(0x89); // PNG magic byte
  });

  it('renders mixed sections (fields, chart, table)', () => {
    const mixedTemplate: FragmentTemplate = {
      title: 'Fund Dashboard',
      sections: [
        {
          title: 'Summary',
          layout: 'grid-2',
          fields: [
            { label: 'Fund Name', key: 'name' },
            { label: 'NAV', key: 'currentNav', format: 'currency' },
          ],
        },
        {
          title: 'Performance Chart',
          layout: 'chart',
          chart: {
            height: 200,
            spec: {
              mark: 'bar',
              encoding: {
                x: { field: 'period', type: 'nominal' },
                y: { field: 'return', type: 'quantitative' }
              }
            },
            dataKey: 'returns'
          }
        },
        {
          title: 'Transactions',
          layout: 'table',
          columns: [
            { header: 'Date', key: 'date', format: 'date' },
            { header: 'Amount', key: 'amount', format: 'currency' },
          ],
          dataKey: 'transactions',
        },
      ],
    };

    const data = {
      name: 'Acme Fund',
      currentNav: 150000000,
      returns: [
        { period: 'Q1', return: 5.2 },
        { period: 'Q2', return: 3.8 },
      ],
      transactions: [
        { date: '2024-01-01', amount: 50000000 },
      ],
    };

    const buffer = renderToBuffer(mixedTemplate, data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});

describe('chart text preview', () => {
  it('generates preview for chart section', () => {
    const template: FragmentTemplate = {
      title: 'Fund Dashboard',
      sections: [{
        title: 'Performance',
        layout: 'chart',
        chart: {
          title: 'NAV Trend',
          description: 'Monthly NAV values',
          height: 300,
          spec: {
            mark: 'line'
          },
          dataKey: 'navHistory'
        }
      }],
    };

    const preview = generateTextPreview(template, ['navHistory']);
    expect(preview).toContain('chart');
    expect(preview).toContain('NAV Trend');
    expect(preview).toContain('navHistory');
    expect(preview).toContain('line');
    expect(preview).toContain('300px');
  });

  it('warns about missing dataKey in chart', () => {
    const template: FragmentTemplate = {
      title: 'Dashboard',
      sections: [{
        title: 'Chart',
        layout: 'chart',
        chart: {
          spec: { mark: 'bar' },
          dataKey: 'missingData'
        }
      }],
    };

    const preview = generateTextPreview(template, ['otherKey']);
    expect(preview).toContain('not found');
  });
});
