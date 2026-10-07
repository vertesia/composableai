import * as Canonical from '@llumiverse/conversation/schemas';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { ApiSchemaComponents } from '../api-contract/index.js';
import type { ConversationRequestSourceViewReference } from '../index.js';
import { CANONICAL_CONVERSATION_SCHEMAS } from './canonical-conversation.js';

describe('published selected-content source view reference', () => {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://source-view-reference-test', components: { schemas: ApiSchemaComponents } });
    const validate = ajv.compile({
        $ref: 'vertesia://source-view-reference-test#/components/schemas/ConversationRequestSourceViewReference',
    });
    const reference = {
        version: 1,
        completeness: 'selected_content_unverified',
        source: { conversation_id: 'conversation', revision: 1 },
        context_revision: 1,
        manifest_storage_key: 'runs/run/canonical-conversation/selected-requests/manifests/hash.json',
        manifest_content_hash: `sha256:${'a'.repeat(64)}`,
        manifest_size_bytes: 128,
        context_fingerprint: `sha256:${'b'.repeat(64)}`,
        request_fingerprint: `sha256:${'c'.repeat(64)}`,
    };

    it('keeps the root type and registry bound to the canonical schema', () => {
        expectTypeOf<ConversationRequestSourceViewReference>().toEqualTypeOf<
            z.infer<typeof Canonical.RequestSourceViewReferenceSchema>
        >();
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationRequestSourceViewReference).toBe(
            Canonical.RequestSourceViewReferenceSchema,
        );
    });

    it('preserves legacy inspection while rejecting unknown or missing completeness', () => {
        for (const completeness of ['selected_content_unverified', 'selected_execution']) {
            const value = { ...reference, completeness };
            expect(Canonical.RequestSourceViewReferenceSchema.safeParse(value).success).toBe(true);
            expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
        }
        for (const value of [
            { ...reference, completeness: 'complete' },
            { ...reference, completeness: undefined },
        ]) {
            expect(Canonical.RequestSourceViewReferenceSchema.safeParse(value).success).toBe(false);
            expect(validate(value)).toBe(false);
        }
    });
});
