/**
 * Tests for text preview generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateTextPreview,
  generateSampleData,
  generateCompactPreview,
} from '../src/render/textPreview.js';
import type { FragmentTemplate } from '../src/types.js';

describe('generateTextPreview', () => {
  const template: FragmentTemplate = {
    title: 'Fund Parameters',
    sections: [
      {
        title: 'Identity',
        layout: 'grid-3',
        fields: [
          { label: 'Firm Name', key: 'firmName' },
          { label: 'Fund Name', key: 'fundName' },
          { label: 'Vintage', key: 'vintageYear', format: 'number' },
        ],
      },
      {
        title: 'Settings',
        layout: 'list',
        collapsed: true,
        fields: [
          { label: 'Active', key: 'active', format: 'boolean', editable: true },
        ],
      },
    ],
    footer: 'Last updated: today',
  };

  const dataKeys = ['firmName', 'fundName', 'vintageYear', 'active'];

  it('generates preview with title', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('Fund Parameters');
  });

  it('includes section titles', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('Identity');
    expect(preview).toContain('Settings');
  });

  it('includes layout information', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('3-column');
    expect(preview).toContain('vertical list');
  });

  it('includes collapsed state', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('collapsed');
  });

  it('includes field details', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('Firm Name');
    expect(preview).toContain('firmName');
    expect(preview).toContain('number');
    expect(preview).toContain('editable');
  });

  it('marks missing keys', () => {
    const preview = generateTextPreview(template, ['firmName']); // missing other keys
    expect(preview).toContain('key not found');
  });

  it('shows success when all keys present', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('All field keys found');
  });

  it('includes footer', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('Last updated');
  });

  it('shows summary', () => {
    const preview = generateTextPreview(template, dataKeys);
    expect(preview).toContain('2 section');
    expect(preview).toContain('4 field');
  });
});

describe('generateSampleData', () => {
  const template: FragmentTemplate = {
    sections: [
      {
        title: 'Test',
        fields: [
          { label: 'Name', key: 'name' },
          { label: 'Count', key: 'count', format: 'number' },
          { label: 'Amount', key: 'amount', format: 'currency' },
          { label: 'Rate', key: 'rate', format: 'percent' },
          { label: 'Date', key: 'date', format: 'date' },
          { label: 'Active', key: 'active', format: 'boolean' },
        ],
      },
    ],
  };

  const dataKeys = ['name', 'count', 'amount', 'rate', 'date', 'active', 'extra'];

  it('generates sample data for all keys', () => {
    const sample = generateSampleData(template, dataKeys);
    expect(sample).toHaveProperty('name');
    expect(sample).toHaveProperty('count');
    expect(sample).toHaveProperty('extra');
  });

  it('generates appropriate values for formats', () => {
    const sample = generateSampleData(template, dataKeys);

    expect(typeof sample.count).toBe('number');
    expect(typeof sample.amount).toBe('number');
    expect(typeof sample.rate).toBe('number');
    expect(typeof sample.active).toBe('boolean');
  });

  it('generates text placeholder for unknown keys', () => {
    const sample = generateSampleData(template, dataKeys);
    expect(sample.extra).toBe('<extra>');
  });
});

describe('generateCompactPreview', () => {
  it('generates compact single-line preview', () => {
    const template: FragmentTemplate = {
      title: 'Test Template',
      sections: [
        {
          title: 'Section A',
          fields: [
            { label: 'Field 1', key: 'f1' },
            { label: 'Field 2', key: 'f2' },
          ],
        },
      ],
    };

    const compact = generateCompactPreview(template);
    expect(compact).toContain('Test Template');
    expect(compact).toContain('Section A');
    expect(compact).toContain('Field 1');
  });

  it('truncates long field lists', () => {
    const template: FragmentTemplate = {
      sections: [
        {
          title: 'Many Fields',
          fields: [
            { label: 'A', key: 'a' },
            { label: 'B', key: 'b' },
            { label: 'C', key: 'c' },
            { label: 'D', key: 'd' },
            { label: 'E', key: 'e' },
          ],
        },
      ],
    };

    const compact = generateCompactPreview(template);
    expect(compact).toContain('+2 more');
  });

  it('handles multiple sections', () => {
    const template: FragmentTemplate = {
      sections: [
        { title: 'S1', fields: [{ label: 'A', key: 'a' }] },
        { title: 'S2', fields: [{ label: 'B', key: 'b' }] },
      ],
    };

    const compact = generateCompactPreview(template);
    expect(compact).toContain('S1');
    expect(compact).toContain('S2');
    expect(compact).toContain('|');
  });
});
