import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const scripts = fileURLToPath(new URL('../../src/modules/service/scripts/', import.meta.url));

for (const sandbox of [false, true]) {
    test(`service ${sandbox ? 'sandbox' : 'node'} build copies skill resource files from a clean project`, async () => {
        const root = mkdtempSync(join(tmpdir(), 'service-skill-assets-'));
        try {
            mkdirSync(join(root, 'src/tool-server'), { recursive: true });
            const skillDir = join(root, 'src/skills/pdf');
            for (const dir of ['scripts/helpers', 'references', 'assets'])
                mkdirSync(join(skillDir, dir), { recursive: true });
            writeFileSync(join(root, 'package.json'), '{"type":"module"}');
            writeFileSync(
                join(skillDir, 'SKILL.md'),
                '---\nname: pdf\ndescription: Process PDFs\n---\nRun scripts/helpers/extract.py\n',
            );
            writeFileSync(join(skillDir, 'properties.ts'), "export default { name: 'renamed-pdf' };");
            const files = {
                'scripts/helpers/extract.py': Buffer.from('print("pdf")'),
                'references/REFERENCE.md': Buffer.from('# PDF'),
                'assets/template.bin': Buffer.from([0, 255, 128, 42]),
            };
            for (const [name, bytes] of Object.entries(files)) writeFileSync(join(skillDir, name), bytes);
            writeFileSync(join(skillDir, 'helper.py'), 'print("legacy")');
            writeFileSync(
                join(root, 'src/tool-server/config.ts'),
                "import skill from '../skills/pdf/SKILL.md'; export const ServerConfig = { skills: [skill], interactions: [] };",
            );
            for (const name of ['server.ts', 'server-node.ts']) {
                writeFileSync(join(root, 'src/tool-server', name), "export { ServerConfig } from './config.js';");
            }
            mkdirSync(join(root, 'scripts'));
            for (const name of ['build-server-esbuild.mjs', 'build-server-support.mjs']) {
                copyFileSync(join(scripts, name), join(root, 'scripts', name));
            }
            mkdirSync(join(root, 'node_modules/@vertesia'), { recursive: true });
            symlinkSync(
                resolve(dirname(require.resolve('@vertesia/build-tools')), '..'),
                join(root, 'node_modules/@vertesia/build-tools'),
            );
            symlinkSync(dirname(require.resolve('esbuild/package.json')), join(root, 'node_modules/esbuild'));

            execFileSync(process.execPath, ['scripts/build-server-esbuild.mjs', ...(sandbox ? ['--sandbox'] : [])], {
                cwd: root,
                stdio: 'pipe',
            });

            for (const [name, bytes] of Object.entries(files)) {
                assert.deepEqual(readFileSync(join(root, 'dist/skill-files/pdf', name)), bytes);
            }
            assert.equal(readFileSync(join(root, 'dist/scripts/helper.py'), 'utf8'), 'print("legacy")');
            const bundle = sandbox ? 'server-sandbox.js' : 'config.js';
            const { ServerConfig } = await import(pathToFileURL(join(root, 'lib', bundle)).href);
            assert.deepEqual(ServerConfig.skills[0].files, Object.keys(files));
            assert.equal(ServerConfig.skills[0].name, 'renamed-pdf');
            assert.equal(ServerConfig.skills[0].files_namespace, 'pdf');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
}
