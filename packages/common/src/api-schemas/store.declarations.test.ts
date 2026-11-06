import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { emitDeclaration } from '../../test/declaration-emit.js';

const storeModule = fileURLToPath(new URL('./store.js', import.meta.url));

/**
 * The type checker cannot see this property: an interface and the inferred schema type it extends are the
 * same type to it. Only declaration emit differs, by printing the inferred type in full at every use, so the
 * test compiles a consumer and reads the declaration it publishes.
 */
describe('intake schema declarations', () => {
    it('reference the configuration and policy by name where another schema embeds them', { timeout: 60_000 }, () => {
        const declaration = emitDeclaration(
            'consumer.d.ts',
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
