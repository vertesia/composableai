/**
 * Tests for prompt transformer
 */

import { describe, it, expect } from 'vitest';
import { promptTransformer, PromptDefinitionSchema, PromptRole, TemplateType } from '../src/presets/prompt.js';

describe('Prompt Transformer', () => {
  it('should parse handlebars prompt with frontmatter', async () => {
    const content = `---
role: user
content_type: handlebars
---
What color is {{object}}?`;

    const result = await promptTransformer.transform(content, 'prompt.hbs');

    expect(result.data).toBeDefined();
    expect(result.data).toHaveProperty('role', PromptRole.user);
    expect(result.data).toHaveProperty('content', 'What color is {{object}}?');
    expect(result.data).toHaveProperty('content_type', TemplateType.handlebars);
  });

  it('should infer content_type from .hbs extension', async () => {
    const content = `---
role: user
---
What color is {{object}}?`;

    const result = await promptTransformer.transform(content, 'prompt.hbs');

    expect(result.data).toHaveProperty('content_type', TemplateType.handlebars);
  });

  it('should infer content_type from .jst extension', async () => {
    const content = `---
role: system
---
You are a helpful assistant.`;

    const result = await promptTransformer.transform(content, 'prompt.jst');

    expect(result.data).toHaveProperty('content_type', TemplateType.jst);
  });

  it('should default content_type to text for unknown extensions', async () => {
    const content = `---
role: user
---
Simple text prompt.`;

    const result = await promptTransformer.transform(content, 'prompt.txt');

    expect(result.data).toHaveProperty('content_type', TemplateType.text);
  });

  it('should include optional name and externalId', async () => {
    const content = `---
role: user
name: color-query
externalId: prompt-123
---
What color is {{object}}?`;

    const result = await promptTransformer.transform(content, 'prompt.hbs');

    expect(result.data).toHaveProperty('name', 'color-query');
    expect(result.data).toHaveProperty('externalId', 'prompt-123');
  });

  it('should generate schema import when schema is specified', async () => {
    const content = `---
role: user
schema: ./schema.ts
---
What color is {{object}}?`;

    const result = await promptTransformer.transform(content, 'prompt.hbs');

    expect(result.imports).toBeDefined();
    expect(result.imports).toHaveLength(1);
    expect(result.imports![0]).toContain("import __promptSchema from './schema.js'");
    expect(result.code).toBeDefined();
    expect(result.code).toContain('schema: __promptSchema');
  });

  it('should normalize schema path without extension', async () => {
    const content = `---
role: user
schema: ./schema
---
What color is {{object}}?`;

    const result = await promptTransformer.transform(content, 'prompt.hbs');

    expect(result.imports![0]).toContain("import __promptSchema from './schema.js'");
  });

  it('should normalize schema path without ./ prefix', async () => {
    const content = `---
role: user
schema: schema.ts
---
What color is {{object}}?`;

    const result = await promptTransformer.transform(content, 'prompt.hbs');

    expect(result.imports![0]).toContain("import __promptSchema from './schema.js'");
  });

  it('should replace .ts with .js in schema path', async () => {
    const content = `---
role: user
schema: ./some/path/schema.ts
---
What color is {{object}}?`;

    const result = await promptTransformer.transform(content, 'prompt.hbs');

    expect(result.imports![0]).toContain("import __promptSchema from './some/path/schema.js'");
  });

  it('should validate against schema successfully', () => {
    const validPrompt = {
      role: PromptRole.user,
      content: 'What color is {{object}}?',
      content_type: TemplateType.handlebars
    };

    const result = PromptDefinitionSchema.safeParse(validPrompt);
    expect(result.success).toBe(true);
  });

  it('should fail validation for invalid role', () => {
    const invalidPrompt = {
      role: 'invalid-role',
      content: 'What color is {{object}}?',
      content_type: TemplateType.handlebars
    };

    const result = PromptDefinitionSchema.safeParse(invalidPrompt);
    expect(result.success).toBe(false);
  });

  it('should fail validation for missing required fields', () => {
    const invalidPrompt = {
      content: 'What color is {{object}}?',
      content_type: TemplateType.handlebars
      // missing role
    };

    const result = PromptDefinitionSchema.safeParse(invalidPrompt);
    expect(result.success).toBe(false);
  });

  it('should throw error for invalid frontmatter', async () => {
    const content = `---
invalid_field: value
---
Some content`;

    await expect(async () => {
      await promptTransformer.transform(content, 'prompt.hbs');
    }).rejects.toThrow(/Invalid frontmatter.*Unrecognized key/s);
  });

  it('should throw error for missing role', async () => {
    const content = `---
content_type: handlebars
---
Some content`;

    await expect(async () => {
      await promptTransformer.transform(content, 'prompt.hbs');
    }).rejects.toThrow(/Invalid frontmatter/);
  });

  it('should support all valid roles', async () => {
    const roles: PromptRole[] = [
      PromptRole.safety,
      PromptRole.system,
      PromptRole.user,
      PromptRole.assistant,
      PromptRole.negative
    ];

    for (const role of roles) {
      const content = `---
role: ${role}
---
Content for ${role}`;

      const result = await promptTransformer.transform(content, 'prompt.txt');
      expect(result.data).toHaveProperty('role', role);
    }
  });
});
