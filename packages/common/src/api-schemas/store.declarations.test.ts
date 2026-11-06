import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tsc = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin', 'tsc');
const storeModule = fileURLToPath(new URL('./store.js', import.meta.url));

/** Emits the declaration a downstream module would publish for `source`, which imports the store schemas. */
function emitDeclaration(source: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'store-dts-'));
    try {
        const consumer = join(dir, 'consumer.ts');
        writeFileSync(consumer, source);
        execFileSync(process.execPath, [
            tsc,
            '--ignoreConfig',
            '--declaration',
            '--emitDeclarationOnly',
            '--strict',
            '--skipLibCheck',
            '--module',
            'nodenext',
            '--moduleResolution',
            'nodenext',
            '--target',
            'es2022',
            '--outDir',
            join(dir, 'out'),
            consumer,
        ]);
        const emitted = readdirSync(join(dir, 'out'), { recursive: true, encoding: 'utf8' }).find((file) =>
            file.endsWith('consumer.d.ts'),
        );
        if (!emitted) throw new Error('tsc emitted no declaration for the consumer');
        return readFileSync(join(dir, 'out', emitted), 'utf8');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * The type checker cannot see this property: an interface and the inferred schema type it extends are the
 * same type to it. Only declaration emit differs, by printing the inferred type in full at every use, so the
 * test compiles a consumer and reads the declaration it publishes.
 */
describe('intake schema declarations', () => {
    it('reference the configuration and policy by name where another schema embeds them', { timeout: 60_000 }, () => {
        const declaration = emitDeclaration(
            'import { ContentTypeIntakePolicySchema, InteractionExecutionConfigurationSchema }\n' +
                `    from ${JSON.stringify(storeModule)};\n` +
                'export const Embedded = {\n' +
                '    config: InteractionExecutionConfigurationSchema.optional(),\n' +
                '    policy: ContentTypeIntakePolicySchema.optional(),\n' +
                '};\n',
        );

        const unnamed = 'an embedded intake schema is printed in full: keep its exported `*SchemaType` annotation';
        expect(declaration, unnamed).toContain('InteractionExecutionConfigurationSchemaType');
        expect(declaration, unnamed).toContain('ContentTypeIntakePolicySchemaType');
        // Printed in full, each type spells out its fields, such as these two.
        expect(declaration, unnamed).not.toContain('prompt_cache_ttl_seconds');
        expect(declaration, unnamed).not.toContain('generate_toc');
    });
});
