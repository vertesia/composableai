import { Ajv2020 } from 'ajv/dist/2020.js';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import { describe, expect, test } from 'vitest';
import { ApiSchemaComponents } from '../api-contract/index.js';
import { ExperimentalAgentAssetExtractionSchema, ExperimentalExtractAgentAssetPayloadSchema } from './agent-assets.js';

const hash = `sha256:${'a'.repeat(64)}`;
const identity = {
    api_version: '=20260930',
    subject_agent_run_id: 'subject',
    operation_id: 'extract:one',
    source_operation_id: 'upload:one',
};
const source = { publication_operation_id: 'upload:one', asset_id: 'asset:original', content_hash: hash };
const transform = { id: 'vertesia.document_text', version: '1', configuration_fingerprint: hash };
const available = {
    ...identity,
    status: 'available',
    derivation: {
        version: 1,
        subject_agent_run_id: identity.subject_agent_run_id,
        operation_id: identity.operation_id,
        source,
        transform,
        output: {
            api_version: identity.api_version,
            subject_agent_run_id: identity.subject_agent_run_id,
            operation_id: 'extraction:sealed',
            published_at: '2026-10-02T00:00:00.000Z',
            asset: {
                id: 'asset:text',
                kind: 'text',
                mime_type: 'text/plain',
                byte_length: 3,
                content_hash: hash,
                created_at: '2026-10-02T00:00:00.000Z',
                storage: {
                    type: 'external',
                    resolver: 'vertesia.agent_artifact',
                    locator: { storage_id: 'owner', artifact_path: 'archive/assets/subject/objects/hash' },
                },
                provenance: {
                    type: 'derived',
                    source_asset_id: source.asset_id,
                    transform_id: transform.id,
                    transform_version: transform.version,
                },
            },
        },
    },
};

function emitted(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true, formats: fullFormats });
    ajv.addSchema({ $id: 'vertesia://asset-extraction', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://asset-extraction#/components/schemas/${name}` });
}
describe('agent asset extraction wire authority', () => {
    test('only accepts an operation and the fixed transform authoring selector', () => {
        const validate = emitted('ExperimentalExtractAgentAssetPayload');
        const body = { operation_id: 'extract:one', transform: 'document_text/v1' };
        for (const [value, valid] of [
            [body, true],
            [{ operation_id: 'extract:one' }, false],
            [{ ...body, transform: 'arbitrary' }, false],
            [{ ...body, workflow_id: 'claimed' }, false],
            [{ ...body, content_hash: hash }, false],
            [{ ...body, output: available.derivation.output }, false],
        ] as const) {
            expect(ExperimentalExtractAgentAssetPayloadSchema.safeParse(value).success).toBe(valid);
            expect(validate(value)).toBe(valid);
        }
    });
    test('keeps strict pending/available/failed branches and mandatory verified lineage at Zod and AJV', () => {
        const validate = emitted('ExperimentalAgentAssetExtraction');
        for (const [value, valid] of [
            [{ ...identity, status: 'pending' }, true],
            [available, true],
            [{ ...identity, status: 'failed', reason: 'extraction_failed', message: 'Unavailable' }, true],
            [{ ...identity, status: 'unknown' }, false],
            [{ ...identity, status: 'available' }, false],
            [{ ...identity, status: 'failed', reason: 'extraction_failed' }, false],
            [{ ...identity, status: 'pending', derivation: available.derivation }, false],
            [
                {
                    ...available,
                    derivation: { ...available.derivation, source: { ...source, content_hash: 'claimed' } },
                },
                false,
            ],
            [
                { ...available, derivation: { ...available.derivation, transform: { ...transform, version: '2' } } },
                false,
            ],
        ] as const) {
            expect(ExperimentalAgentAssetExtractionSchema.safeParse(value).success).toBe(valid);
            expect(validate(value)).toBe(valid);
        }
    });
});
