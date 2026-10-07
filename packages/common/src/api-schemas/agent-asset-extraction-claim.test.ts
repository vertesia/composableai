import { Ajv2020 } from 'ajv/dist/2020.js';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import { describe, expect, test } from 'vitest';
import { ApiSchemaComponents } from '../api-contract/index.js';
import {
    ExperimentalAgentAssetExtractionClaimSchema,
    ExperimentalClaimAgentAssetExtractionPayloadSchema,
} from './agent-assets.js';

const validClaim = {
    api_version: '=20260930',
    subject_agent_run_id: 'subject:one',
    operation_id: 'extract:one',
    workflow_id: `CanonicalAssetExtraction:${'a'.repeat(64)}`,
    run_id: 'service-first-run',
};
function validate(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true, formats: fullFormats });
    ajv.addSchema({ $id: 'vertesia://asset-extraction-claim', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://asset-extraction-claim#/components/schemas/${name}` });
}

describe('pre-I/O extraction claim wire parity', () => {
    test('only a bounded expected-run equality assertion is accepted', () => {
        const ajv = validate('ExperimentalClaimAgentAssetExtractionPayload');
        const cases: [unknown, boolean][] = [
            [{ expected_run_id: validClaim.run_id }, true],
            [{ expected_run_id: 'a'.repeat(1024) }, true],
            [{}, false],
            [{ expected_run_id: '' }, false],
            [{ expected_run_id: 'a'.repeat(1025) }, false],
            [{ expected_run_id: null }, false],
            [{ expected_run_id: 1 }, false],
            [{ expected_run_id: validClaim.run_id, workflow_id: validClaim.workflow_id }, false],
            [{ expected_run_id: validClaim.run_id, namespace: 'caller' }, false],
            [{ expected_run_id: validClaim.run_id, source: { asset_id: 'caller' } }, false],
        ];
        for (const [body, accepted] of cases) {
            expect(ExperimentalClaimAgentAssetExtractionPayloadSchema.safeParse(body).success).toBe(accepted);
            expect(ajv(body)).toBe(accepted);
        }
    });

    test('service acknowledgement requires all exact identities and no caller authority bag', () => {
        const ajv = validate('ExperimentalAgentAssetExtractionClaim');
        expect(ExperimentalAgentAssetExtractionClaimSchema.parse(validClaim)).toEqual(validClaim);
        expect(ajv(validClaim)).toBe(true);
        for (const name of Object.keys(validClaim)) {
            const missing: Record<string, unknown> = { ...validClaim };
            delete missing[name];
            expect(ExperimentalAgentAssetExtractionClaimSchema.safeParse(missing).success).toBe(false);
            expect(ajv(missing)).toBe(false);
        }
        for (const bad of [
            { ...validClaim, api_version: '=20261003' },
            { ...validClaim, run_id: null },
            { ...validClaim, run_id: '' },
            { ...validClaim, run_id: 'a'.repeat(1025) },
            { ...validClaim, workflow_id: 'a'.repeat(1025) },
            { ...validClaim, credential: 'caller-provided' },
        ]) {
            expect(ExperimentalAgentAssetExtractionClaimSchema.safeParse(bad).success).toBe(false);
            expect(ajv(bad)).toBe(false);
        }
    });
});
