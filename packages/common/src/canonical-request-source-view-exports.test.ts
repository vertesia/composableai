import { RequestSourceViewReferenceSchema } from '@llumiverse/conversation/schemas';
import { Ajv } from 'ajv';
import { expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { buildApiSchemaComponents } from './api-schemas/registry.js';
import type { ConversationRequestSourceViewReference } from './index.js';

it('exports the exact bounded request source-view reference as a named transitive receipt component', () => {
    expectTypeOf<ConversationRequestSourceViewReference>().toEqualTypeOf<
        z.infer<typeof RequestSourceViewReferenceSchema>
    >();
    expect(RequestSourceViewReferenceSchema.meta()?.id).toBe('ConversationRequestSourceViewReference');
    const components = buildApiSchemaComponents();
    expect(components.ConversationRequestReceipt).toHaveProperty(
        'properties.source_view.$ref',
        '#/components/schemas/ConversationRequestSourceViewReference',
    );
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile({
        $ref: '#/components/schemas/ConversationRequestSourceViewReference',
        components: { schemas: components },
    });
    const valid: ConversationRequestSourceViewReference = {
        version: 1,
        completeness: 'selected_execution',
        source: { conversation_id: 'conversation', revision: 1 },
        context_revision: 1,
        manifest_storage_key: 'opaque',
        manifest_content_hash: `sha256:${'a'.repeat(64)}`,
        manifest_size_bytes: 4096,
        context_fingerprint: 'sha256:context',
        request_fingerprint: 'sha256:request',
    };
    for (const [value, accepted] of [
        [valid, true],
        [{ ...valid, manifest_size_bytes: 256 * 1024 + 1 }, false],
        [{ ...valid, manifest_content_hash: 'sha256:invalid' }, false],
        [{ ...valid, completeness: 'full_document' }, false],
        [{ ...valid, manifest_storage_key: 'opaque', extra: true }, false],
    ] as const) {
        expect(RequestSourceViewReferenceSchema.safeParse(value).success).toBe(accepted);
        expect(validate(value)).toBe(accepted);
    }
});
