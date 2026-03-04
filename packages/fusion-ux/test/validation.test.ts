/**
 * Tests for template validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateTemplate,
  parseAndValidateTemplate,
  findClosestKey,
  findSimilarKeys,
  formatValidationErrors,
} from '../src/validation/index.js';
import type { FragmentTemplate } from '../src/types.js';

describe('validateTemplate', () => {
  const validTemplate: FragmentTemplate = {
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
    ],
  };

  const dataKeys = ['firmName', 'fundName', 'vintageYear', 'targetSize', 'currency'];

  it('validates a correct template', () => {
    const result = validateTemplate(validTemplate, dataKeys);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing required fields', () => {
    const invalidTemplate = {
      sections: [
        {
          title: 'Test',
          fields: [
            { label: 'Name' }, // missing 'key'
          ],
        },
      ],
    };

    const result = validateTemplate(invalidTemplate, dataKeys);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('key'))).toBe(true);
  });

  it('detects unknown keys with suggestion', () => {
    const templateWithTypo: FragmentTemplate = {
      sections: [
        {
          title: 'Test',
          fields: [{ label: 'Firm', key: 'frimName' }], // typo
        },
      ],
    };

    const result = validateTemplate(templateWithTypo, dataKeys);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("'frimName'");
    expect(result.errors[0].suggestion).toContain('firmName');
  });

  it('detects invalid enum values', () => {
    const templateWithBadFormat = {
      sections: [
        {
          title: 'Test',
          fields: [{ label: 'Name', key: 'firmName', format: 'invalid' }],
        },
      ],
    };

    const result = validateTemplate(templateWithBadFormat, dataKeys);
    expect(result.valid).toBe(false);
  });

  it('validates min/max constraints', () => {
    const templateWithBadMinMax: FragmentTemplate = {
      sections: [
        {
          title: 'Test',
          fields: [{ label: 'Value', key: 'targetSize', min: 100, max: 10 }],
        },
      ],
    };

    const result = validateTemplate(templateWithBadMinMax, dataKeys);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('min'))).toBe(true);
  });

  it('validates select options requirement', () => {
    const templateWithSelectNoOptions: FragmentTemplate = {
      sections: [
        {
          title: 'Test',
          fields: [
            { label: 'Currency', key: 'currency', inputType: 'select' }, // no options
          ],
        },
      ],
    };

    const result = validateTemplate(templateWithSelectNoOptions, dataKeys);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('options'))).toBe(true);
  });
});

describe('parseAndValidateTemplate', () => {
  const dataKeys = ['name', 'value'];

  it('parses valid JSON and validates', () => {
    const json = JSON.stringify({
      sections: [{ title: 'Test', fields: [{ label: 'Name', key: 'name' }] }],
    });

    const result = parseAndValidateTemplate(json, dataKeys);
    expect(result.valid).toBe(true);
    expect(result.template).toBeDefined();
  });

  it('returns error for invalid JSON', () => {
    const badJson = '{ invalid json }';

    const result = parseAndValidateTemplate(badJson, dataKeys);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('JSON');
  });

  it('returns error for valid JSON but invalid template', () => {
    const json = JSON.stringify({ notSections: [] });

    const result = parseAndValidateTemplate(json, dataKeys);
    expect(result.valid).toBe(false);
  });
});

describe('findClosestKey', () => {
  const validKeys = ['firmName', 'fundName', 'vintageYear', 'targetSize'];

  it('finds exact case-insensitive match', () => {
    expect(findClosestKey('FIRMNAME', validKeys)).toBe('firmName');
  });

  it('finds close match with typo', () => {
    expect(findClosestKey('frimName', validKeys)).toBe('firmName');
  });

  it('finds substring match', () => {
    expect(findClosestKey('vintage', validKeys)).toBe('vintageYear');
  });

  it('returns undefined for very different keys', () => {
    expect(findClosestKey('xyzabc', validKeys)).toBeUndefined();
  });
});

describe('findSimilarKeys', () => {
  const validKeys = ['firmName', 'fundName', 'firmType', 'fundType'];

  it('returns multiple similar keys', () => {
    const similar = findSimilarKeys('firm', validKeys);
    expect(similar).toContain('firmName');
    expect(similar).toContain('firmType');
  });

  it('respects maxResults limit', () => {
    const similar = findSimilarKeys('firm', validKeys, 1);
    expect(similar).toHaveLength(1);
  });
});

describe('formatValidationErrors', () => {
  it('formats single error', () => {
    const errors = [{ path: 'sections[0].fields[0].key', message: 'Unknown key' }];
    const formatted = formatValidationErrors(errors);
    expect(formatted).toContain('1 error');
    expect(formatted).toContain('Unknown key');
  });

  it('formats multiple errors', () => {
    const errors = [
      { path: 'a', message: 'Error 1' },
      { path: 'b', message: 'Error 2', suggestion: 'Fix it' },
    ];
    const formatted = formatValidationErrors(errors);
    expect(formatted).toContain('2 errors');
    expect(formatted).toContain('Fix it');
  });

  it('returns success message for empty errors', () => {
    const formatted = formatValidationErrors([]);
    expect(formatted).toContain('valid');
  });
});
