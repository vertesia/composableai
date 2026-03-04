/**
 * Tests for chart layout support
 */

import { describe, it, expect } from 'vitest';
import { validateTemplate } from '../src/validation/index.js';
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

// NOTE: Serverless rendering tests have been moved to apps/tools
// See apps/tools/src/tools/fusion-ux/_shared/renderFragment.ts

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
