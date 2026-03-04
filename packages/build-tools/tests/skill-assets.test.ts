/**
 * Tests for skill transformer with assets
 */

import { describe, it, expect } from 'vitest';
import { skillTransformer, SkillDefinitionSchema } from '../src/presets/skill.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Skill Transformer with Assets', () => {
  it('should include scripts and widgets in skill definition', async () => {
    const filePath = join(__dirname, 'fixtures', 'skill-with-assets', 'SKILL.md');
    const content = readFileSync(filePath, 'utf-8');

    const result = await skillTransformer.transform(content, filePath);

    expect(result.data).toHaveProperty('scripts');
    expect(result.data).toHaveProperty('widgets');

    const data = result.data as any;
    expect(data.scripts).toContain('helper.js');
    expect(data.scripts).toContain('script.py');
    expect(data.widgets).toContain('widget');
  });

  it('should include asset files for copying', async () => {
    const filePath = join(__dirname, 'fixtures', 'skill-with-assets', 'SKILL.md');
    const content = readFileSync(filePath, 'utf-8');

    const result = await skillTransformer.transform(content, filePath);

    expect(result.assets).toBeDefined();
    expect(result.assets).toHaveLength(2); // 2 scripts, no widgets

    const scriptAssets = result.assets!.filter(a => a.type === 'script');
    expect(scriptAssets).toHaveLength(2);
  });

  it('should validate skill with scripts and widgets', () => {
    const skillWithAssets = {
      name: 'test',
      title: 'Test',
      description: 'Test description',
      instructions: 'Content',
      content_type: 'md' as const,
      scripts: ['helper.js', 'script.py'],
      widgets: ['widget']
    };

    const result = SkillDefinitionSchema.safeParse(skillWithAssets);
    expect(result.success).toBe(true);
  });

  it('should not include empty arrays for skills without assets', async () => {
    const filePath = join(__dirname, 'fixtures', 'example-skill.md');
    const content = readFileSync(filePath, 'utf-8');

    const result = await skillTransformer.transform(content, filePath);

    const data = result.data as any;
    expect(data.scripts).toBeUndefined();
    expect(data.widgets).toBeUndefined();
  });
});
