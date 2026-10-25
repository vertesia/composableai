/**
 * Tests for asset discovery utilities
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverSkillAssets } from '../src/core/utils/asset-discovery.js';

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
        const scriptAssets = assets.assetFiles.filter((a) => a.type === 'script');
        expect(scriptAssets).toHaveLength(2);

        // Widgets should NOT have asset files (compiled separately)
        const widgetAssets = assets.assetFiles.filter((a) => (a.type as string) === 'widget');
        expect(widgetAssets).toHaveLength(0);
    });

    it('should use custom scriptsDir option', () => {
        const skillPath = join(__dirname, 'fixtures', 'skill-with-assets', 'SKILL.md');
        const assets = discoverSkillAssets(skillPath, {
            scriptsDir: 'custom-scripts',
        });

        const scriptAsset = assets.assetFiles.find((a) => a.sourcePath.endsWith('helper.js'));
        expect(scriptAsset?.destPath).toContain('custom-scripts');
    });

    it('should handle skills with no assets', () => {
        const skillPath = join(__dirname, 'fixtures', 'example-skill.md');
        const assets = discoverSkillAssets(skillPath);

        expect(assets.scripts).toHaveLength(0);
        expect(assets.widgets).toHaveLength(0);
        expect(assets.assetFiles).toHaveLength(0);
        expect(assets.files).toHaveLength(0);
    });

    it('should discover Agent Skills resource directories recursively, keeping relative paths', () => {
        const skillPath = join(__dirname, 'fixtures', 'spec-skill', 'SKILL.md');
        const assets = discoverSkillAssets(skillPath, { skillName: 'pdf-processing' });

        expect(assets.files).toEqual([
            'scripts/extract.py',
            'scripts/helpers/util.py',
            'references/REFERENCE.md',
            'assets/template.txt',
        ]);
        const resourceAssets = assets.assetFiles.filter((a) => a.type === 'skill-file');
        expect(resourceAssets.map((a) => a.destPath)).toEqual([
            join('skill-files', 'pdf-processing', 'scripts', 'extract.py'),
            join('skill-files', 'pdf-processing', 'scripts', 'helpers', 'util.py'),
            join('skill-files', 'pdf-processing', 'references', 'REFERENCE.md'),
            join('skill-files', 'pdf-processing', 'assets', 'template.txt'),
        ]);
    });

    it('should keep flat scripts beside SKILL.md on the legacy path', () => {
        const skillPath = join(__dirname, 'fixtures', 'spec-skill', 'SKILL.md');
        const assets = discoverSkillAssets(skillPath, { skillName: 'pdf-processing' });

        expect(assets.scripts).toEqual(['helper.py']);
        const scriptAssets = assets.assetFiles.filter((a) => a.type === 'script');
        expect(scriptAssets.map((a) => a.destPath)).toEqual([join('scripts', 'helper.py')]);
    });

    it('should not attribute resource directories to a skill that shares its directory', () => {
        const skillPath = join(__dirname, 'fixtures', 'spec-skill', 'other.md');
        const assets = discoverSkillAssets(skillPath);

        expect(assets.files).toHaveLength(0);
    });

    it('should reject a skill name that would escape the resource directory', () => {
        const skillPath = join(__dirname, 'fixtures', 'spec-skill', 'SKILL.md');
        expect(() => discoverSkillAssets(skillPath, { skillName: '../escape' })).toThrow(/Invalid skill name/);
    });

    it('should skip linked files, directories and cycles inside resource directories', () => {
        const root = mkdtempSync(join(tmpdir(), 'skill-symlinks-'));
        try {
            const skillDir = join(root, 'skill');
            mkdirSync(join(skillDir, 'assets'), { recursive: true });
            mkdirSync(join(root, 'private'));
            writeFileSync(join(root, 'private', 'secret.txt'), 'private build data');
            writeFileSync(join(skillDir, 'assets', 'safe.txt'), 'public');
            symlinkSync(join(root, 'private', 'secret.txt'), join(skillDir, 'assets', 'linked.txt'));
            symlinkSync(join(root, 'private'), join(skillDir, 'assets', 'linked-dir'));
            symlinkSync(skillDir, join(skillDir, 'assets', 'cycle'));
            symlinkSync(join(skillDir, 'assets', 'safe.txt'), join(skillDir, 'assets', 'internal-link.txt'));

            const assets = discoverSkillAssets(join(skillDir, 'SKILL.md'));

            expect(assets.files).toEqual(['assets/safe.txt']);
            expect(assets.assetFiles.map((asset) => asset.sourcePath)).toEqual([join(skillDir, 'assets', 'safe.txt')]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it.each(['scripts', 'references', 'assets'])('should skip a linked %s resource root', (directory) => {
        const root = mkdtempSync(join(tmpdir(), 'skill-root-symlink-'));
        try {
            const skillDir = join(root, 'skill');
            mkdirSync(skillDir);
            mkdirSync(join(root, 'private'));
            writeFileSync(join(root, 'private', 'secret.txt'), 'private build data');
            symlinkSync(join(root, 'private'), join(skillDir, directory));

            const assets = discoverSkillAssets(join(skillDir, 'SKILL.md'));

            expect(assets.files).toEqual([]);
            expect(assets.assetFiles).toEqual([]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
