/**
 * Tests for asset discovery utilities
 */

import { describe, it, expect } from 'vitest';
import { discoverSkillAssets } from '../src/utils/asset-discovery.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Asset Discovery', () => {
  it('should discover scripts and widgets in skill directory', () => {
    const skillPath = join(__dirname, 'fixtures', 'skill-with-assets', 'SKILL.md');
    const assets = discoverSkillAssets(skillPath);

    expect(assets.scripts).toContain('helper.js');
    expect(assets.scripts).toContain('script.py');
    expect(assets.widgets).toContain('widget');
    expect(assets.scripts).toHaveLength(2);
    expect(assets.widgets).toHaveLength(1);
  });

  it('should create asset files for scripts only', () => {
    const skillPath = join(__dirname, 'fixtures', 'skill-with-assets', 'SKILL.md');
    const assets = discoverSkillAssets(skillPath);

    // Scripts should have asset files
    const scriptAssets = assets.assetFiles.filter(a => a.type === 'script');
    expect(scriptAssets).toHaveLength(2);

    // Widgets should NOT have asset files (compiled separately)
    const widgetAssets = assets.assetFiles.filter(a => a.type === 'widget');
    expect(widgetAssets).toHaveLength(0);
  });

  it('should use custom scriptsDir option', () => {
    const skillPath = join(__dirname, 'fixtures', 'skill-with-assets', 'SKILL.md');
    const assets = discoverSkillAssets(skillPath, {
      scriptsDir: 'custom-scripts'
    });

    const scriptAsset = assets.assetFiles.find(a => a.sourcePath.endsWith('helper.js'));
    expect(scriptAsset?.destPath).toContain('custom-scripts');
  });

  it('should handle skills with no assets', () => {
    const skillPath = join(__dirname, 'fixtures', 'example-skill.md');
    const assets = discoverSkillAssets(skillPath);

    expect(assets.scripts).toHaveLength(0);
    expect(assets.widgets).toHaveLength(0);
    expect(assets.assetFiles).toHaveLength(0);
  });
});
