import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { SkillCollection } from '../SkillCollection.js';
import type { SkillDefinition } from '../types.js';
import { createSkillsRoute } from './skills.js';
import type { ToolServerConfig } from './types.js';

const specSkill: SkillDefinition = {
    name: 'pdf-processing',
    description: 'Extract text from PDF files',
    instructions: 'Run `scripts/extract.py`.',
    content_type: 'md',
    scripts: ['helper.py'],
    files: ['scripts/extract.py', 'references/REFERENCE.md'],
};

const legacySkill: SkillDefinition = {
    name: 'legacy',
    description: 'A skill with flat scripts only',
    instructions: 'Run `~/skills/legacy/helper.py`.',
    content_type: 'md',
    scripts: ['helper.py'],
};

const collection = new SkillCollection({ name: 'docs', skills: [specSkill, legacySkill] });

function makeApp(config: ToolServerConfig): Hono {
    const app = new Hono();
    createSkillsRoute(app, '/api/skills', config);
    return app;
}

async function executeSkill(name: string, skills = collection): Promise<{ content: string }> {
    const app = new Hono();
    app.post('/', (c) => skills.execute(c, { tool_use: { id: 't1', tool_name: `learn_${name}`, tool_input: {} } }));
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(200);
    return (await res.json()) as { content: string };
}

describe('skills route', () => {
    it('lists Agent Skills resource files with their relative paths and URLs', async () => {
        const res = await makeApp({ skills: [collection] }).request(
            'https://tools.test/api/skills/docs/learn_pdf-processing/files',
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            skill_name: 'pdf-processing',
            files: [
                {
                    path: 'scripts/extract.py',
                    url: 'https://tools.test/skill-files/pdf-processing/scripts/extract.py',
                },
                {
                    path: 'references/REFERENCE.md',
                    url: 'https://tools.test/skill-files/pdf-processing/references/REFERENCE.md',
                },
            ],
        });
    });

    it('keeps resource URLs on their build namespace when the runtime skill name is overridden', async () => {
        const renamed = new SkillCollection({
            name: 'docs',
            skills: [
                {
                    ...specSkill,
                    name: 'renamed-pdf',
                    files_namespace: 'pdf-processing',
                },
            ],
        });
        const res = await makeApp({ skills: [renamed] }).request(
            'https://tools.test/api/skills/docs/renamed-pdf/files',
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            skill_name: 'renamed-pdf',
            files: [
                { path: 'scripts/extract.py', url: 'https://tools.test/skill-files/pdf-processing/scripts/extract.py' },
                {
                    path: 'references/REFERENCE.md',
                    url: 'https://tools.test/skill-files/pdf-processing/references/REFERENCE.md',
                },
            ],
        });
    });

    it('returns no files for a skill without resource directories', async () => {
        const res = await makeApp({ skills: [collection] }).request('https://tools.test/api/skills/docs/legacy/files');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ skill_name: 'legacy', files: [] });
    });

    it('keeps the scripts endpoint limited to the flat scripts', async () => {
        const res = await makeApp({ skills: [collection] }).request(
            'https://tools.test/api/skills/docs/pdf-processing/scripts',
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            skill_name: 'pdf-processing',
            scripts: ['https://tools.test/scripts/helper.py'],
        });
    });

    it('404s for an unknown skill', async () => {
        const res = await makeApp({ skills: [collection] }).request('https://tools.test/api/skills/docs/missing/files');
        expect(res.status).toBe(404);
    });
});

describe('skill execution', () => {
    it('tells the agent where the resource files are in the sandbox', async () => {
        const body = await executeSkill('pdf-processing');
        expect(body.content).toContain('Run `scripts/extract.py`.');
        expect(body.content).toContain('`~/skills/pdf-processing/`');
        expect(body.content).toContain('- `references/REFERENCE.md`');
    });

    it.each([20, 21, 250])('bounds the instruction file list for %i resources', async (count) => {
        const files = Array.from({ length: count }, (_, index) => `assets/file-${index}.bin`);
        const skills = new SkillCollection({ name: 'docs', skills: [{ ...specSkill, files }] });

        const body = await executeSkill(specSkill.name, skills);

        expect(body.content).toContain('`assets/file-19.bin`');
        expect(body.content).not.toContain('`assets/file-20.bin`');
        if (count > 20) expect(body.content).toContain(`${count - 20} more file`);
        else expect(body.content).not.toContain('more files');
        expect(body.content.length).toBeLessThan(3000);
        expect(skills.getSkill(specSkill.name)?.files).toHaveLength(count);
    });

    it('bounds long resource paths without flooding the learned instructions', async () => {
        const skills = new SkillCollection({
            name: 'docs',
            skills: [{ ...specSkill, files: [`assets/${'a'.repeat(3000)}`] }],
        });
        const body = await executeSkill(specSkill.name, skills);
        expect(body.content.length).toBeLessThan(1000);
        expect(body.content).toContain('1 more file.');
        expect(body.content).toContain('Use execute_shell to list this directory');
    });

    it('returns the instructions unchanged when the skill has no resource files', async () => {
        const body = await executeSkill('legacy');
        expect(body.content).toBe('Run `~/skills/legacy/helper.py`.');
    });
});
