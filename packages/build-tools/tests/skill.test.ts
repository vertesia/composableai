/**
 * Tests for skill transformer
 */

import { describe, it, expect } from 'vitest';
import { skillTransformer, SkillDefinitionSchema } from '../src/presets/skill.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Skill Transformer', () => {
  it('should parse skill markdown with frontmatter', async () => {
    const filePath = join(__dirname, 'fixtures', 'example-skill.md');
    const content = readFileSync(filePath, 'utf-8');

    const result = await skillTransformer.transform(content, filePath);

    expect(result.data).toBeDefined();
    expect(result.data).toHaveProperty('name', 'test-skill');
    expect(result.data).toHaveProperty('title', 'Test Skill');
    expect(result.data).toHaveProperty('description', 'A test skill for unit tests');
    expect(result.data).toHaveProperty('instructions');
    expect(result.data).toHaveProperty('content_type', 'md');
  });

  it('should include context_triggers with keywords from frontmatter', async () => {
    const content = `---
name: test
title: Test
description: Test description
context_triggers:
  keywords: [foo, bar, baz]
---
Content here`;

    const result = await skillTransformer.transform(content, 'test.md');
    expect(result.data).toHaveProperty('context_triggers');
    expect((result.data as any).context_triggers).toEqual({
      keywords: ['foo', 'bar', 'baz']
    });
  });

  it('should include related_tools from frontmatter', async () => {
    const content = `---
name: test
title: Test
description: Test description
related_tools: [tool1, tool2]
---
Content`;

    const result = await skillTransformer.transform(content, 'test.md');
    expect(result.data).toHaveProperty('related_tools');
    expect((result.data as any).related_tools).toEqual(['tool1', 'tool2']);
  });

  it('should validate against schema successfully', () => {
    const validSkill = {
      name: 'test',
      title: 'Test',
      description: 'Test description',
      instructions: 'Content here',
      content_type: 'md'
    };

    const result = SkillDefinitionSchema.safeParse(validSkill);
    expect(result.success).toBe(true);
  });

  it('should fail validation for missing required fields', () => {
    const invalidSkill = {
      name: 'test',
      // missing description, instructions, and content_type
      title: 'Test'
    };

    const result = SkillDefinitionSchema.safeParse(invalidSkill);
    expect(result.success).toBe(false);
  });

  it('should fail validation for empty required fields', () => {
    const invalidSkill = {
      name: '',  // empty string
      title: 'Test',
      description: 'Test description',
      instructions: 'Content',
      content_type: 'md'
    };

    const result = SkillDefinitionSchema.safeParse(invalidSkill);
    expect(result.success).toBe(false);
  });
});
