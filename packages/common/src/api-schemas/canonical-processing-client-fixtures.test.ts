import fs from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiSchemaComponents } from '../api-contract/index.js';
import type {
    ConversationAcceptedToolSelection,
    ConversationContextChangeProposal,
    ConversationEditAnchor,
    ConversationEditOperation,
    ConversationEditPlacement,
    ConversationEditRecordRef,
    ConversationOperationReceipt,
    ConversationProcessingAttemptReceipt,
    ConversationProcessingBudget,
    ConversationProcessingCompletionReceipt,
    ConversationProcessingJob,
    ConversationProcessingJobSelection,
    ConversationProcessingOperation,
    ConversationProcessingOutputReceipt,
    ConversationProcessingReadinessCoverage,
    ConversationProcessingResolvedInput,
    ConversationProcessingState,
    ConversationProcessingSupersessionReceipt,
} from '../index.js';
import { CANONICAL_CONVERSATION_SCHEMAS as schemas } from './canonical-conversation.js';

const components = [
    'ConversationEditOperationV1',
    'ConversationSliceEditOperation',
    'ConversationSourceBlockSlice',
    'ConversationJsonSourceRegion',
    'ConversationJsonInverseMapping',
    'ConversationDerivedBlockLineageGroup',
    'ConversationDerivedBlockLineage',

    'ConversationAcceptedToolSelection',
    'ConversationContextChangeProposal',
    'ConversationEditAnchor',
    'ConversationEditOperation',
    'ConversationEditPlacement',
    'ConversationEditRecordRef',
    'ConversationOperationReceipt',
    'ConversationProcessingAttemptReceipt',
    'ConversationProcessingBudget',
    'ConversationProcessingCompletionReceipt',
    'ConversationProcessingJob',
    'ConversationProcessingJobSelection',
    'ConversationProcessingOperation',
    'ConversationProcessingOutputReceipt',
    'ConversationProcessingReadinessCoverage',
    'ConversationProcessingResolvedInput',
    'ConversationProcessingState',
    'ConversationProcessingSupersessionReceipt',
] as const;
// Compile the exact published components, including refs, without widening ApiSchemaMap.
const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
ajvFormats.default(ajv);
ajv.addSchema({ $id: 'vertesia://processing-client-fixtures', components: { schemas: ApiSchemaComponents } });
const validators = new Map(
    components.map(
        (component) =>
            [
                component,
                ajv.compile({
                    $ref: `vertesia://processing-client-fixtures#/components/schemas/${component}`,
                }),
            ] as const,
    ),
);
function validatePublished(component: (typeof components)[number], value: unknown): boolean {
    const validator = validators.get(component);
    if (!validator) throw new Error('Missing published processing fixture validator');
    return validator(value);
}
const fixtures = z
    .strictObject({
        purpose: z.string(),
        cases: z.array(z.strictObject({ name: z.string(), component: z.enum(components), value: z.unknown() })),
        invalid: z.array(z.strictObject({ name: z.string(), component: z.enum(components), value: z.unknown() })),
    })
    .parse(
        JSON.parse(
            fs.readFileSync(
                new URL('../../test-fixtures/canonical-interaction-processing-receipts.json', import.meta.url),
                'utf8',
            ),
        ),
    );
function first(component: (typeof components)[number]) {
    const fixture = fixtures.cases.find((row) => row.component === component);
    if (!fixture) throw new Error('Missing named processing component fixture');
    return fixture.value;
}

describe('published edit and processing receipt client fixtures', () => {
    it('covers all sixteen added components and both expanded receipt/state contracts through root public aliases', () => {
        expect([...new Set(fixtures.cases.map((row) => row.component))].sort()).toEqual([...components].sort());
        const published = {
            ConversationAcceptedToolSelection: schemas.ConversationAcceptedToolSelection.parse(
                first('ConversationAcceptedToolSelection'),
            ),
            ConversationContextChangeProposal: schemas.ConversationContextChangeProposal.parse(
                first('ConversationContextChangeProposal'),
            ),
            ConversationEditAnchor: schemas.ConversationEditAnchor.parse(first('ConversationEditAnchor')),
            ConversationEditOperation: schemas.ConversationEditOperation.parse(first('ConversationEditOperation')),
            ConversationEditPlacement: schemas.ConversationEditPlacement.parse(first('ConversationEditPlacement')),
            ConversationEditRecordRef: schemas.ConversationEditRecordRef.parse(first('ConversationEditRecordRef')),
            ConversationOperationReceipt: schemas.ConversationOperationReceipt.parse(
                first('ConversationOperationReceipt'),
            ),
            ConversationProcessingAttemptReceipt: schemas.ConversationProcessingAttemptReceipt.parse(
                first('ConversationProcessingAttemptReceipt'),
            ),
            ConversationProcessingBudget: schemas.ConversationProcessingBudget.parse(
                first('ConversationProcessingBudget'),
            ),
            ConversationProcessingCompletionReceipt: schemas.ConversationProcessingCompletionReceipt.parse(
                first('ConversationProcessingCompletionReceipt'),
            ),
            ConversationProcessingJob: schemas.ConversationProcessingJob.parse(first('ConversationProcessingJob')),
            ConversationProcessingJobSelection: schemas.ConversationProcessingJobSelection.parse(
                first('ConversationProcessingJobSelection'),
            ),
            ConversationProcessingOperation: schemas.ConversationProcessingOperation.parse(
                first('ConversationProcessingOperation'),
            ),
            ConversationProcessingOutputReceipt: schemas.ConversationProcessingOutputReceipt.parse(
                first('ConversationProcessingOutputReceipt'),
            ),
            ConversationProcessingReadinessCoverage: schemas.ConversationProcessingReadinessCoverage.parse(
                first('ConversationProcessingReadinessCoverage'),
            ),
            ConversationProcessingResolvedInput: schemas.ConversationProcessingResolvedInput.parse(
                first('ConversationProcessingResolvedInput'),
            ),
            ConversationProcessingState: schemas.ConversationProcessingState.parse(
                first('ConversationProcessingState'),
            ),
            ConversationProcessingSupersessionReceipt: schemas.ConversationProcessingSupersessionReceipt.parse(
                first('ConversationProcessingSupersessionReceipt'),
            ),
        } satisfies {
            ConversationAcceptedToolSelection: ConversationAcceptedToolSelection;
            ConversationContextChangeProposal: ConversationContextChangeProposal;
            ConversationEditAnchor: ConversationEditAnchor;
            ConversationEditOperation: ConversationEditOperation;
            ConversationEditPlacement: ConversationEditPlacement;
            ConversationEditRecordRef: ConversationEditRecordRef;
            ConversationOperationReceipt: ConversationOperationReceipt;
            ConversationProcessingAttemptReceipt: ConversationProcessingAttemptReceipt;
            ConversationProcessingBudget: ConversationProcessingBudget;
            ConversationProcessingCompletionReceipt: ConversationProcessingCompletionReceipt;
            ConversationProcessingJob: ConversationProcessingJob;
            ConversationProcessingJobSelection: ConversationProcessingJobSelection;
            ConversationProcessingOperation: ConversationProcessingOperation;
            ConversationProcessingOutputReceipt: ConversationProcessingOutputReceipt;
            ConversationProcessingReadinessCoverage: ConversationProcessingReadinessCoverage;
            ConversationProcessingResolvedInput: ConversationProcessingResolvedInput;
            ConversationProcessingState: ConversationProcessingState;
            ConversationProcessingSupersessionReceipt: ConversationProcessingSupersessionReceipt;
        };
        expect(Object.keys(published)).toHaveLength(18);
        expect(fixtures.cases).toHaveLength(70);
        expect(fixtures.invalid).toHaveLength(48);
    });
    it.each(fixtures.cases)(
        'round trips $name through the authoritative Zod public contract',
        ({ component, value }) => {
            const parsed = schemas[component].parse(value);
            expect(JSON.parse(JSON.stringify(parsed))).toEqual(value);
            expect(validatePublished(component, value)).toBe(true);
        },
    );
    it.each(fixtures.invalid)(
        'rejects invalid known discriminants or required fields in $name',
        ({ component, value }) => {
            expect(schemas[component].safeParse(value).success).toBe(false);
            expect(validatePublished(component, value)).toBe(false);
        },
    );
});
