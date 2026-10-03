import { Ajv2020 } from 'ajv/dist/2020.js';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import { describe, expect, test } from 'vitest';
import { ApiSchemaComponents } from '../api-contract/index.js';
import { ExperimentalAgentAssetPublicationSchema, ExperimentalPublishAgentAssetPayloadSchema } from './agent-assets.js';

const publication = {
    api_version: '=20260930',
    subject_agent_run_id: 'subject',
    operation_id: 'upload:one',
    published_at: '2026-10-02T00:00:00.000Z',
    asset: {
        id: 'asset:one',
        kind: 'text',
        mime_type: 'text/plain',
        storage: {
            type: 'external',
            resolver: 'vertesia.agent_artifact',
            locator: { storage_id: 'owner', artifact_path: 'archive/assets/subject/objects/hash' },
        },
        provenance: { type: 'received' },
        byte_length: 3,
        content_hash: `sha256:${'a'.repeat(64)}`,
        created_at: '2026-10-02T00:00:00.000Z',
    },
};
function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true, formats: fullFormats });
    ajv.addSchema({ $id: 'vertesia://asset-publication', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://asset-publication#/components/schemas/${name}` });
}
describe('canonical asset publication wire parity', () => {
    test('uses the same strict authoring selector at Zod and emitted AJV boundary', () => {
        const validate = validator('ExperimentalPublishAgentAssetPayload');
        for (const [body, valid] of [
            [{ operation_id: 'upload:one', artifact_path: 'files/my image.png' }, true],
            [{ operation_id: 'upload:one', artifact_path: 'files/文\u2028件.txt' }, true],
            [{ operation_id: 'upload:one', artifact_path: '../foreign' }, false],
            [{ operation_id: 'upload:one', artifact_path: '/foreign' }, false],
            ...[
                'files\u2028/../foreign',
                'files\u2029//bad',
                'files/',
                'files/new\nline',
                'files/control\u0000name',
                'files/del\u007fname',
            ].map((artifact_path) => [{ operation_id: 'upload:one', artifact_path }, false] as const),
            [{ operation_id: 'upload:one', artifact_path: 'files/../foreign' }, false],
            [{ operation_id: 'upload:one', artifact_path: 'files/a', content_hash: 'claimed' }, false],
            [{ operation_id: 'upload:one', artifact_path: 'files/a', storage_id: 'foreign' }, false],
            [{ artifact_path: 'files/a' }, false],
        ] as const) {
            expect(ExperimentalPublishAgentAssetPayloadSchema.safeParse(body).success).toBe(valid);
            expect(validate(body)).toBe(valid);
        }
    });
    test('requires verified hash/size and exact API version without widening Asset identity', () => {
        const validate = validator('ExperimentalAgentAssetPublication');
        expect(validate(publication)).toBe(true);
        expect(ExperimentalAgentAssetPublicationSchema.safeParse(publication).success).toBe(true);
        for (const change of [
            { asset: { ...publication.asset, byte_length: undefined } },
            { asset: { ...publication.asset, content_hash: undefined } },
            ...['garbage', 'sha256:abc', `sha256:${'A'.repeat(64)}`].map((content_hash) => ({
                asset: { ...publication.asset, content_hash },
            })),
            { asset: { ...publication.asset, byte_length: 50 * 1024 * 1024 + 1 } },
            { api_version: 'latest' },
            { unexpected: true },
        ]) {
            const invalid = JSON.parse(JSON.stringify({ ...publication, ...change }));
            expect(validate(invalid)).toBe(false);
            expect(ExperimentalAgentAssetPublicationSchema.safeParse(invalid).success).toBe(false);
        }
    });
});
