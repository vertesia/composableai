/**
 * Tests for table layout support
 */

import { describe, it, expect } from 'vitest';
import { validateTemplate } from '../src/validation/index.js';
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

// NOTE: Serverless rendering tests have been moved to apps/tools
// See apps/tools/src/tools/fusion-ux/_shared/renderFragment.ts

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
