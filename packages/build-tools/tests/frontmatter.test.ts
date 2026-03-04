/**
 * Tests for frontmatter parser
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../src/parsers/frontmatter.js';

describe('Frontmatter Parser', () => {
  it('should parse YAML frontmatter', () => {
    const markdown = `---
title: Test
author: John Doe
tags: [one, two, three]
---

# Content

This is the content.`;

    const result = parseFrontmatter(markdown);

    expect(result.frontmatter).toEqual({
      title: 'Test',
      author: 'John Doe',
      tags: ['one', 'two', 'three']
    });
    expect(result.content).toContain('# Content');
    expect(result.content).not.toContain('---');
  });

  it('should handle content without frontmatter', () => {
    const markdown = `# No Frontmatter

Just plain content.`;

    const result = parseFrontmatter(markdown);

    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe(markdown);
  });

  it('should handle empty content', () => {
    const markdown = '';

    const result = parseFrontmatter(markdown);

    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe('');
  });

  it('should handle nested objects in frontmatter', () => {
    const markdown = `---
config:
  nested:
    value: 123
  array: [1, 2, 3]
---
Content`;

    const result = parseFrontmatter(markdown);

    expect(result.frontmatter.config).toEqual({
      nested: { value: 123 },
      array: [1, 2, 3]
    });
  });
});
