import fs from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiSchemaComponents } from '../api-contract/index.js';
import type {
    ConversationAcceptedToolSelection,
    ConversationContextChangeProposal,
    ConversationContextRetrievalRequirement,
    ConversationEditAnchor,
    ConversationEditOperation,
    ConversationEditPlacement,
    ConversationEditRecordRef,
    ConversationExecutionReceipt,
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
    ConversationToolExecutionMetadata,
    ConversationToolRetrievalExcerpt,
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
    'ConversationContextRetrievalRequirement',
    'ConversationExecutionReceipt',
    'ConversationToolExecutionMetadata',
    'ConversationToolRetrievalExcerpt',
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

function named(name: string): unknown {
    const row = fixtures.cases.find((entry) => entry.name === name);
    if (!row) throw new Error(`Missing authoritative retrieval fixture ${name}`);
    return row.value;
}

describe('published edit and processing receipt client fixtures', () => {
    it('preserves optional receipt witnesses and exact typed retrieval identities/JSON arguments', () => {
        const absent: ConversationOperationReceipt = schemas.ConversationOperationReceipt.parse(
            named('receipt_retrieval_requirements_absent'),
        );
        const empty: ConversationOperationReceipt = schemas.ConversationOperationReceipt.parse(
            named('receipt_retrieval_requirements_empty'),
        );
        const retained: ConversationOperationReceipt = schemas.ConversationOperationReceipt.parse(
            named('receipt_retrieval_requirements_structured'),
        );
        expect(absent).not.toHaveProperty('accepted_retrieval_requirements');
        expect(empty.accepted_retrieval_requirements).toEqual([]);
        expect(retained.accepted_retrieval_requirements).toHaveLength(2);
        const requirement = retained.accepted_retrieval_requirements?.[0];
        if (!requirement) throw new Error('Missing typed accepted requirement');
        expect(requirement.asset_id).toBe('asset:archive');
        expect(requirement.accepted_asset_operation_id).toBe('append:original-assets');
        expect(requirement.retrieval.tool_definition_id).toBe('definition:read-artifact');
        expect(requirement.retrieval.arguments).toEqual({
            path: 'canonical-tool-results/v1/tool/call/result.json',
            start_byte: 17,
            byte_count: 29,
            options: { custom: null, labels: ['résumé', true, 3] },
        });
        expect(retained.accepted_retrieval_requirements?.[1].retrieval.capability).toBe('future:canonical-reader');
        expect(retained.accepted_retrieval_requirements?.[1]).not.toHaveProperty('accepted_asset_operation_id');
        const unannotated: ConversationExecutionReceipt = schemas.ConversationExecutionReceipt.parse(
            named('execution_receipt_retrieval_metadata_absent'),
        );
        expect(unannotated).not.toHaveProperty('metadata');
        for (const mode of ['byte', 'line']) {
            const execution: ConversationExecutionReceipt = schemas.ConversationExecutionReceipt.parse(
                named(`execution_receipt_retrieval_${mode}_excerpt`),
            );
            const excerpt: ConversationToolRetrievalExcerpt = schemas.ConversationToolRetrievalExcerpt.parse(
                named(`retrieval_excerpt_${mode === 'byte' ? 'bytes' : 'lines'}_exact_identity`),
            );
            expect(execution.metadata?.retrieval_excerpt).toEqual(excerpt);
            expect(excerpt).toMatchObject({
                asset_id: requirement.asset_id,
                accepted_asset_operation_id: requirement.accepted_asset_operation_id,
                tool_definition_id: requirement.retrieval.tool_definition_id,
                byte_start: 17,
                byte_end_exclusive: 46,
            });
        }
    });
    it('covers published processing and retrieval receipt components through root public aliases', () => {
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
            ConversationContextRetrievalRequirement: schemas.ConversationContextRetrievalRequirement.parse(
                first('ConversationContextRetrievalRequirement'),
            ),
            ConversationExecutionReceipt: schemas.ConversationExecutionReceipt.parse(
                first('ConversationExecutionReceipt'),
            ),
            ConversationToolExecutionMetadata: schemas.ConversationToolExecutionMetadata.parse(
                first('ConversationToolExecutionMetadata'),
            ),
            ConversationToolRetrievalExcerpt: schemas.ConversationToolRetrievalExcerpt.parse(
                first('ConversationToolRetrievalExcerpt'),
            ),
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
            ConversationContextRetrievalRequirement: ConversationContextRetrievalRequirement;
            ConversationExecutionReceipt: ConversationExecutionReceipt;
            ConversationToolExecutionMetadata: ConversationToolExecutionMetadata;
            ConversationToolRetrievalExcerpt: ConversationToolRetrievalExcerpt;
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
        expect(Object.keys(published)).toHaveLength(22);
        expect(fixtures.cases).toHaveLength(82);
        expect(fixtures.invalid).toHaveLength(65);
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
