import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ExperimentalCanonicalInteractionExecutionResultSchema } from './canonical-interaction-execution.js';
import { ApiSchemaComponents } from './registry.js';

const at = '2026-10-02T00:00:00.000Z';
const standalone = {
    run: { id: 'run:1', status: 'completed', created_at: at, updated_at: at, retention: 'STANDARD' },
    output: { status: 'unavailable', reason: 'no_accepted_response' },
    history: { status: 'unavailable', reason: 'not_requested', retention: 'STANDARD' },
};
const admission = {
    version: 1,
    request_id: 'request:1',
    input_fingerprint: 'input:1',
    admitted_at: at,
    execution: { workflow_id: 'current:workflow', chain_first_run_id: 'current:chain' },
    routing_control: {
        version: 2,
        kind: 'initial',
        operation_id: 'routing:1',
        payload_fingerprint: 'routing:hash',
        recorded_at: at,
        base_revision: 0,
        result_revision: 0,
        intent: { model: 'model:1' },
        owner: {
            account_id: 'account:1',
            project_id: 'project:1',
            subject_agent_run_id: 'agent:1',
            owner_agent_run_id: 'agent:1',
            scope: 'root',
            namespace_origin_first_run_id: 'origin:chain',
        },
        origin_execution: { workflow_id: 'origin:workflow', first_run_id: 'origin:chain' },
    },
};

describe('canonical interaction generation-admission execution metadata', () => {
    it('preserves standalone interactions without adding a receipt to provider output', () => {
        expect(ExperimentalCanonicalInteractionExecutionResultSchema.parse(standalone)).toEqual(standalone);
    });
    it('reuses the published strict receipt as optional host metadata in Zod and registry JSON Schema', () => {
        const result = { ...standalone, generation_admission: admission };
        expect(ExperimentalCanonicalInteractionExecutionResultSchema.parse(result)).toEqual(result);
        const ajv = new Ajv2020({ strict: false, validateFormats: false });
        const validate = ajv.compile({
            components: { schemas: ApiSchemaComponents },
            $ref: '#/components/schemas/ExperimentalCanonicalInteractionExecutionResult',
        });
        expect(validate(result)).toBe(true);
        expect(validate(standalone)).toBe(true);
        const malformed = { ...result, generation_admission: { ...admission, caller_proof: 'forged' } };
        expect(validate(malformed)).toBe(false);
        expect(ExperimentalCanonicalInteractionExecutionResultSchema.safeParse(malformed).success).toBe(false);
        expect(result.output).not.toHaveProperty('generation_admission');
    });
});
