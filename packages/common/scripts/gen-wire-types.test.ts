import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const BIN = join(PACKAGE, 'node_modules', '.bin');

/** Runs a package binary; a failure reports what it printed rather than just the exit code. */
function run(bin: string, args: string[]): void {
    try {
        execFileSync(join(BIN, bin), args, { stdio: 'pipe', encoding: 'utf8' });
    } catch (error) {
        const { stdout, stderr } = error as { stdout?: string; stderr?: string };
        throw new Error(`${bin} failed:\n${stdout ?? ''}${stderr ?? ''}`);
    }
}

/**
 * Runs `gen-wire-types.ts` over a fixture tree, then type-checks the tree with the files it wrote. The
 * tree lives under this package's `node_modules` so `zod` and `vitest` resolve from it.
 */
function generate(files: Record<string, string>): { dir: string; read: (file: string) => string } {
    const root = join(PACKAGE, 'node_modules', '.tmp');
    mkdirSync(root, { recursive: true });
    const dir = mkdtempSync(join(root, 'gen-wire-types-'));
    dirs.push(dir);
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, file)), { recursive: true });
        writeFileSync(join(dir, file), text);
    }
    run('tsx', [join(PACKAGE, 'scripts', 'gen-wire-types.ts'), '--src', dir, '--no-format']);
    const read = (file: string) => readFileSync(join(dir, file), 'utf8');
    const tsFiles = [...Object.keys(files), 'wire-types.generated.ts', 'wire-types.generated.test.ts'];
    run('tsc', [
        '--ignoreConfig',
        '--checkers',
        '1',
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--target',
        'es2022',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        ...tsFiles.map((file) => join(dir, file)),
    ]);
    return { dir, read };
}

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('gen-wire-types', () => {
    it('preserves registry components when formatting wraps schema references', { timeout: 60_000 }, () => {
        const { read } = generate({
            'payload.ts': [
                "import { z } from 'zod';",
                'export const PayloadSchema = z.strictObject({ name: z.string() });',
                'export type Payload = z.infer<typeof PayloadSchema>;',
            ].join('\n'),
            'api-schemas/registry.ts': [
                "import * as PayloadSchemas from '../payload.js';",
                'type FixtureSchemaMap = { WrappedPayload: typeof PayloadSchemas.PayloadSchema };',
                'const FIXTURE_SCHEMAS: FixtureSchemaMap = {',
                '    // Keep this component registered when its value wraps.',
                '    WrappedPayload:',
                '        PayloadSchemas.PayloadSchema,',
                '};',
                'export type ApiComponentName = keyof typeof FIXTURE_SCHEMAS;',
            ].join('\n'),
        });
        expect(read('wire-types.generated.ts')).toMatch(/WrappedPayload: Payload;/);
        expect(read('wire-types.generated.test.ts')).toContain('Payload: Same<');
    });

    it('references canonical tool execution types from their owning package', { timeout: 60_000 }, () => {
        const { read } = generate({
            'api-schemas/registry.ts': [
                "import { ConversationToolExecutionResultSchema } from '@llumiverse/conversation/schemas';",
                'const FIXTURE_SCHEMAS = {',
                '    ConversationToolExecutionResult: ConversationToolExecutionResultSchema,',
                '};',
                'export type ApiComponentName = keyof typeof FIXTURE_SCHEMAS;',
            ].join('\n'),
        });
        expect(read('wire-types.generated.ts')).toContain(
            "import type { ConversationToolExecutionResult } from '@llumiverse/conversation';",
        );
        expect(read('wire-types.generated.ts')).toMatch(
            /ConversationToolExecutionResult: ConversationToolExecutionResult;/,
        );
    });

    it('keeps a Wire.X alias resolving when its schema becomes unsupported', { timeout: 60_000 }, () => {
        // `Prefixed` was generated once, so its module already reads `Wire.Prefixed`; a template literal
        // is not something the walker writes out.
        const { read } = generate({
            'prefixed.ts': [
                "import { z } from 'zod';",
                "import type * as Wire from './wire-types.generated.js';",
                '',
                "export const PrefixedSchema = z.templateLiteral(['prefix-', z.string()]);",
                '/** A prefixed id. */',
                'export type Prefixed = Wire.Prefixed;',
                '',
                'export const TaggedSchema = z.object({ id: PrefixedSchema, count: z.number() });',
                'export type Tagged = z.infer<typeof TaggedSchema>;',
                '',
            ].join('\n'),
        });

        const generated = read('wire-types.generated.ts');
        expect(generated).toContain(
            "/** A prefixed id. */\nexport type Prefixed = z.infer<typeof import('./prefixed.js').PrefixedSchema>;",
        );
        // A supported type that embeds it still names it, and its module is pointed at the generated type.
        expect(generated).toMatch(/export type Tagged = \{[^}]*\bid: Prefixed;/);
        expect(read('prefixed.ts')).toContain('export type Prefixed = Wire.Prefixed;');
        expect(read('prefixed.ts')).toContain('export type Tagged = Wire.Tagged;');
        // Only the generated type is asserted against its schema; the fallback is `z.infer` itself.
        expect(read('wire-types.generated.test.ts')).toContain('Tagged: Same<');
        expect(read('wire-types.generated.test.ts')).not.toContain('Prefixed: Same<');
    });
});
