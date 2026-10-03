import { readFileSync } from 'node:fs';
import * as Canonical from '@llumiverse/conversation/schemas';
import { Ajv2020 } from 'ajv/dist/2020.js';
import formatsPlugin from 'ajv-formats';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { ApiSchemaComponents } from '../api-contract/index.js';
import type {
    ConversationJsonMinificationApplication,
    ConversationJsonMinificationMeasuredProjection,
    ConversationJsonMinificationMeasurement,
    ConversationJsonMinificationNoOpReason,
    ConversationJsonMinificationProposal,
    ConversationJsonMinificationTransform,
} from '../index.js';
import { CANONICAL_CONVERSATION_SCHEMAS } from './canonical-conversation.js';

const fixture = z
    .strictObject({
        purpose: z.string(),
        entries: z.array(
            z.strictObject({
                name: z.string(),
                component: z.enum([
                    'ConversationJsonMinificationTransform',
                    'ConversationJsonMinificationMeasuredProjection',
                    'ConversationJsonMinificationMeasurement',
                    'ConversationJsonMinificationProposal',
                    'ConversationJsonMinificationNoOpReason',
                    'ConversationJsonMinificationApplication',
                    'ConversationProcessingOutputReceipt',
                    'ConversationOperationReceipt',
                    'ConversationProcessingState',
                ]),
                valid: z.boolean(),
                value: z.unknown(),
            }),
        ),
    })
    .parse(
        JSON.parse(
            readFileSync(new URL('../../test-fixtures/canonical-json-minification.json', import.meta.url), 'utf8'),
        ),
    );

describe('published JSON minification processing closure', () => {
    it('exports exact schema-inferred types from the public root', () => {
        expectTypeOf<ConversationJsonMinificationTransform>().toEqualTypeOf<
            z.infer<typeof Canonical.JsonMinificationTransformSchema>
        >();
        expectTypeOf<ConversationJsonMinificationMeasuredProjection>().toEqualTypeOf<
            z.infer<typeof Canonical.JsonMinificationMeasuredProjectionSchema>
        >();
        expectTypeOf<ConversationJsonMinificationMeasurement>().toEqualTypeOf<
            z.infer<typeof Canonical.JsonMinificationMeasurementSchema>
        >();
        expectTypeOf<ConversationJsonMinificationProposal>().toEqualTypeOf<
            z.infer<typeof Canonical.JsonMinificationProposalSchema>
        >();
        expectTypeOf<ConversationJsonMinificationNoOpReason>().toEqualTypeOf<
            z.infer<typeof Canonical.JsonMinificationNoOpReasonSchema>
        >();
        expectTypeOf<ConversationJsonMinificationApplication>().toEqualTypeOf<
            z.infer<typeof Canonical.JsonMinificationApplicationSchema>
        >();
    });

    it('registers the original canonical schemas without alternate definitions', () => {
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationJsonMinificationTransform).toBe(
            Canonical.JsonMinificationTransformSchema,
        );
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationJsonMinificationMeasuredProjection).toBe(
            Canonical.JsonMinificationMeasuredProjectionSchema,
        );
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationJsonMinificationMeasurement).toBe(
            Canonical.JsonMinificationMeasurementSchema,
        );
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationJsonMinificationProposal).toBe(
            Canonical.JsonMinificationProposalSchema,
        );
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationJsonMinificationNoOpReason).toBe(
            Canonical.JsonMinificationNoOpReasonSchema,
        );
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationJsonMinificationApplication).toBe(
            Canonical.JsonMinificationApplicationSchema,
        );
    });

    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    formatsPlugin.default(ajv);
    ajv.addSchema({ $id: 'vertesia://json-minification-test', components: { schemas: ApiSchemaComponents } });
    for (const entry of fixture.entries) {
        it(`${entry.name}: Zod and exported API schema validate identical bytes`, () => {
            const validate = ajv.compile({
                $ref: `vertesia://json-minification-test#/components/schemas/${entry.component}`,
            });
            expect(CANONICAL_CONVERSATION_SCHEMAS[entry.component].safeParse(entry.value).success).toBe(entry.valid);
            expect(validate(entry.value), JSON.stringify(validate.errors)).toBe(entry.valid);
        });
    }
});
