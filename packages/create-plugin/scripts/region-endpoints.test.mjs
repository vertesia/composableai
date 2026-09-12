import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyDevModeAnswers, replaceVariables } from '../lib/process-template.js';
import { promptUser } from '../lib/prompts.js';

const templateRoot = new URL('../../../templates/plugin-template/', import.meta.url);

for (const [region, devMode, authUrl, stsUrl] of [
    ['us1', false, 'https://auth.us1.vertesia.io/', 'https://sts.vertesia.io'],
    ['eu1', false, 'https://auth.eu1.vertesia.io/', 'https://sts.eu1.vertesia.io'],
    ['eu1', true, 'https://auth.dev1.vertesia.io/', 'https://sts.dev1.vertesia.io'],
]) {
    test(`scaffolding ${region} (dev=${devMode}) configures the matching auth broker`, async () => {
        const config = JSON.parse(readFileSync(new URL('template.config.json', templateRoot), 'utf8'));
        const regionPrompt = config.prompts.find((prompt) => prompt.name === 'REGION');
        regionPrompt.initial = regionPrompt.choices.findIndex((choice) => choice.value === region);
        const answers = await promptUser('example-app', config, true);
        if (devMode) applyDevModeAnswers(config, answers);
        const root = mkdtempSync(join(tmpdir(), 'create-plugin-region-'));
        try {
            writeFileSync(join(root, '.env.app.template'), readFileSync(new URL('.env.app.template', templateRoot)));
            replaceVariables(root, { ...config, files: ['.env.app.template'] }, answers);
            const env = readFileSync(join(root, '.env.app.template'), 'utf8');
            assert.ok(env.includes(`VITE_AUTH_SERVER_URL=${authUrl}\n`));
            assert.ok(env.includes(`VITE_VERTESIA_STS_URL=${stsUrl}\n`));
            assert.ok(!env.includes('{{'));
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
}
