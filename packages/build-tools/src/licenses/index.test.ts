import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    collectThirdPartyLicenses,
    packageRootOf,
    renderThirdPartyLicensesJson,
    renderThirdPartyNotices,
    thirdPartyLicenses,
} from './index.js';

let root: string;

function writePackage(dir: string, manifest: Record<string, unknown>, files: Record<string, string> = {}) {
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
    writeFileSync(join(dir, 'lib', 'index.js'), 'export default 1;');
    for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(dir, name), content);
    }
}

beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'third-party-licenses-'));
    const modules = join(root, 'node_modules');
    writePackage(
        join(modules, 'left-pad'),
        { name: 'left-pad', version: '1.3.0', license: 'WTFPL' },
        { LICENSE: 'WTFPL text' },
    );
    writePackage(
        join(modules, '.pnpm', 'zod@4.0.0', 'node_modules', '@scope', 'zod'),
        { name: '@scope/zod', version: '4.0.0', license: 'MIT', repository: { url: 'https://github.com/x/zod' } },
        { 'LICENSE.md': 'MIT text', NOTICE: 'Notice text', 'README.md': 'not a license' },
    );
    writePackage(join(modules, 'legacy'), {
        name: 'legacy',
        version: '0.1.0',
        licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }],
    });
    writePackage(join(modules, 'internal'), { name: 'internal', version: '1.0.0', private: true });
    writePackage(join(modules, 'proprietary'), { name: 'proprietary', version: '1.0.0', license: 'UNLICENSED' });
});

afterAll(() => {
    rmSync(root, { recursive: true, force: true });
});

describe('packageRootOf', () => {
    it('finds the package after the last node_modules segment, scoped or not', () => {
        expect(packageRootOf('/r/node_modules/a/lib/x.js')).toBe('/r/node_modules/a');
        expect(packageRootOf('/r/node_modules/.pnpm/b@1/node_modules/@s/b/x.js?commonjs')).toBe(
            '/r/node_modules/.pnpm/b@1/node_modules/@s/b',
        );
        expect(packageRootOf('/r/src/main.ts')).toBeUndefined();
        expect(packageRootOf('/r/node_modules/@s')).toBeUndefined();
    });
});

describe('collectThirdPartyLicenses', () => {
    it('lists each bundled package once, sorted, with its license files', () => {
        const modules = join(root, 'node_modules');
        const packages = collectThirdPartyLicenses([
            join(modules, 'left-pad', 'lib', 'index.js'),
            join(modules, 'left-pad', 'package.json'),
            join(modules, '.pnpm', 'zod@4.0.0', 'node_modules', '@scope', 'zod', 'lib', 'index.js'),
            join(modules, 'legacy', 'lib', 'index.js'),
            join(modules, 'internal', 'lib', 'index.js'),
            join(modules, 'proprietary', 'lib', 'index.js'),
            join(root, 'src', 'main.ts'),
        ]);
        expect(packages.map((p) => [p.name, p.license, p.texts.map((t) => t.file)])).toEqual([
            ['@scope/zod', 'MIT', ['LICENSE.md', 'NOTICE']],
            ['left-pad', 'WTFPL', ['LICENSE']],
            ['legacy', '(MIT OR Apache-2.0)', []],
        ]);
    });

    it('leaves out excluded names', () => {
        const packages = collectThirdPartyLicenses([join(root, 'node_modules', 'left-pad', 'lib', 'index.js')], {
            exclude: [/^left-/],
        });
        expect(packages).toEqual([]);
    });
});

describe('rendering', () => {
    it('writes the texts and says when a package ships none', () => {
        const packages = collectThirdPartyLicenses([
            join(root, 'node_modules', 'left-pad', 'lib', 'index.js'),
            join(root, 'node_modules', 'legacy', 'lib', 'index.js'),
        ]);
        const text = renderThirdPartyNotices(packages, 'my-app');
        expect(text).toContain('Third-party software notices for my-app');
        expect(text).toContain('left-pad 1.3.0\nLicense: WTFPL');
        expect(text).toContain('LICENSE:\n\nWTFPL text');
        expect(text).toContain('The package ships no license file');
        expect(JSON.parse(renderThirdPartyLicensesJson(packages)).packages).toHaveLength(2);
    });
});

describe('thirdPartyLicenses plugin', () => {
    it('emits both files from the modules of the generated chunks', () => {
        const emitted: { fileName: string; source: string }[] = [];
        const plugin = thirdPartyLicenses({ title: 'bundle' });
        plugin.generateBundle.call(
            {
                emitFile: (file) => {
                    emitted.push(file);
                    return file.fileName;
                },
            },
            {},
            {
                'main.js': {
                    type: 'chunk',
                    modules: { [join(root, 'node_modules', 'left-pad', 'lib', 'index.js')]: {} },
                },
                'style.css': { type: 'asset' },
            },
        );
        expect(emitted.map((f) => f.fileName)).toEqual(['THIRD-PARTY-NOTICES.txt', 'third-party-licenses.json']);
        expect(emitted[0].source).toContain('left-pad 1.3.0');
    });
});
