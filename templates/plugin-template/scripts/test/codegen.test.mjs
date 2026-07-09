import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const templateRoot = path.resolve(testDir, '../..');
const codegenScript = path.join(templateRoot, 'scripts/dist/codegen.js');
const generatedFiles = [
    'src/ui/app-ui-entry.tsx',
    'src/ui/app-ui-modules.tsx',
    'src/tool-server/app-server-modules.ts',
];

function copyTemplateInputs(targetRoot) {
    fs.copyFileSync(path.join(templateRoot, 'template.config.json'), path.join(targetRoot, 'template.config.json'));
    fs.cpSync(path.join(templateRoot, 'src/modules'), path.join(targetRoot, 'src/modules'), { recursive: true });
}

test('default module codegen matches checked-in generated files', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-template-codegen-'));
    try {
        copyTemplateInputs(tmpRoot);
        const contextPath = path.join(tmpRoot, '.create-plugin-context.json');
        fs.writeFileSync(contextPath, `${JSON.stringify({ modules: ['default'] }, null, 2)}\n`);

        execFileSync(process.execPath, [codegenScript, '--context', contextPath], {
            cwd: tmpRoot,
            stdio: 'pipe',
        });

        for (const file of generatedFiles) {
            const expected = fs.readFileSync(path.join(templateRoot, file), 'utf8');
            const actual = fs.readFileSync(path.join(tmpRoot, file), 'utf8');
            assert.equal(actual, expected, `${file} should match default codegen output`);
        }
    } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
});
