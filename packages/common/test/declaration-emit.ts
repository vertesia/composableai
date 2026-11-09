import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsc = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin', 'tsc');
const tsconfig = fileURLToPath(new URL('../tsconfig.json', import.meta.url));

/** Compiler options for a consumer module compiled on its own, the way a downstream package would. */
const CONSUMER_OPTIONS = [
    '--ignoreConfig',
    '--declaration',
    '--strict',
    '--skipLibCheck',
    '--module',
    'nodenext',
    '--moduleResolution',
    'nodenext',
    '--target',
    'es2022',
];

/**
 * Emits declarations with this package's `tsc` into a temporary directory and returns the one whose path
 * ends with `declaration`.
 *
 * With `consumer`, compiles that source as `consumer.ts`, a downstream module that imports this package's
 * sources by absolute path. Without it, compiles the package with its own `tsconfig.json`.
 *
 * Declaration emit is the only way to observe whether a schema type is referenced by name or printed in
 * full: the type checker sees an interface and the inferred type it extends as the same type.
 */
export function emitDeclaration(declaration: string, consumer?: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'vertesia-common-dts-'));
    try {
        const out = join(dir, 'out');
        let input: string[];
        if (consumer === undefined) {
            input = ['-p', tsconfig, '--declarationMap', 'false', '--tsBuildInfoFile', join(dir, 'tsbuildinfo')];
        } else {
            const file = join(dir, 'consumer.ts');
            writeFileSync(file, consumer);
            input = [...CONSUMER_OPTIONS, file];
        }
        execFileSync(process.execPath, [tsc, ...input, '--emitDeclarationOnly', '--outDir', out]);
        const emitted = readdirSync(out, { recursive: true, encoding: 'utf8' }).find((file) =>
            file.endsWith(declaration),
        );
        if (!emitted) throw new Error(`tsc emitted no ${declaration}`);
        return readFileSync(join(out, emitted), 'utf8');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
