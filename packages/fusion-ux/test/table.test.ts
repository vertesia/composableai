/**
 * Tests for table layout support
 */

import { describe, it, expect } from 'vitest';
import { validateTemplate } from '../src/validation/index.js';
import { renderToBuffer } from '../src/render/serverlessRender.js';
import { generateTextPreview } from '../src/render/textPreview.js';
import type { FragmentTemplate } from '../src/types.js';

describe('table layout validation', () => {
  it('validates a correct table section', () => {
    const template: FragmentTemplate = {
      sections: [{
        title: 'Transactions',
        layout: 'table',
        columns: [
          { header: 'Date', key: 'date', format: 'date' },
          { header: 'Type', key: 'type' },
          { header: 'Amount', key: 'amount', format: 'currency' },
        ],
        dataKey: 'transactions',
      }],
    };

    const result = validateTemplate(template, ['transactions']);
    expect(result.valid).toBe(true);
  });

  it('requires columns for table layout', () => {
    const template = {
      sections: [{
        title: 'Table',
        layout: 'table',
        dataKey: 'items',
        // missing columns
      }],
    };

    const result = validateTemplate(template, ['items']);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('columns'))).toBe(true);
  });

  it('requires dataKey for table layout', () => {
    const template = {
      sections: [{
        title: 'Table',
        layout: 'table',
        columns: [{ header: 'Name', key: 'name' }],
        // missing dataKey
      }],
    };

    const result = validateTemplate(template, ['items']);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('dataKey'))).toBe(true);
  });

  it('validates dataKey exists in data', () => {
    const template: FragmentTemplate = {
      sections: [{
        title: 'Table',
        layout: 'table',
        columns: [{ header: 'Name', key: 'name' }],
        dataKey: 'nonexistent',
      }],
    };

    const result = validateTemplate(template, ['items', 'other']);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('nonexistent'))).toBe(true);
  });

  it('requires fields for non-table layouts', () => {
    const template = {
      sections: [{
        title: 'Grid Section',
        layout: 'grid-3',
        // missing fields
      }],
    };

    const result = validateTemplate(template, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('fields'))).toBe(true);
  });
});

describe('table serverless rendering', () => {
  const tableTemplate: FragmentTemplate = {
    title: 'Transaction History',
    sections: [{
      title: 'Recent Transactions',
      layout: 'table',
      columns: [
        { header: 'Date', key: 'date', format: 'date' },
        { header: 'Description', key: 'description' },
        { header: 'Amount', key: 'amount', format: 'currency' },
      ],
      dataKey: 'transactions',
    }],
  };

  it('renders table with data', () => {
    const data = {
      transactions: [
        { date: '2024-01-15', description: 'Capital Call', amount: 5000000 },
        { date: '2024-02-01', description: 'Distribution', amount: -2000000 },
        { date: '2024-03-15', description: 'Capital Call', amount: 3000000 },
      ],
    };

    const buffer = renderToBuffer(tableTemplate, data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer[0]).toBe(0x89); // PNG magic byte
  });

  it('renders empty table', () => {
    const data = {
      transactions: [],
    };

    const buffer = renderToBuffer(tableTemplate, data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('handles missing dataKey in data', () => {
    const buffer = renderToBuffer(tableTemplate, {});
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('renders mixed sections (fields and table)', () => {
    const mixedTemplate: FragmentTemplate = {
      title: 'Fund Overview',
      sections: [
        {
          title: 'Summary',
          layout: 'grid-2',
          fields: [
            { label: 'Fund Name', key: 'name' },
            { label: 'Total Value', key: 'value', format: 'currency' },
          ],
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
      value: 100000000,
      transactions: [
        { date: '2024-01-01', amount: 50000000 },
      ],
    };

    const buffer = renderToBuffer(mixedTemplate, data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});

describe('table text preview', () => {
  it('generates preview for table section', () => {
    const template: FragmentTemplate = {
      title: 'Data Table',
      sections: [{
        title: 'Items',
        layout: 'table',
        columns: [
          { header: 'Name', key: 'name' },
          { header: 'Value', key: 'value', format: 'number' },
        ],
        dataKey: 'items',
      }],
    };

    const preview = generateTextPreview(template, ['items']);
    expect(preview).toContain('table');
    expect(preview).toContain('items');
    expect(preview).toContain('Name');
    expect(preview).toContain('Value');
  });
});
