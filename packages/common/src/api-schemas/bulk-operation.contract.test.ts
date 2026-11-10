import { describe, expect, it } from 'vitest';
import type { BulkOperationPayload, BulkOperationResponse } from '../common.js';
import type { BulkOperationPayloadSchema, BulkOperationResponseSchema } from './bulk-operation.js';
import { validateApiRequest, validateApiResponse } from './registry.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_value: T): void {}

describe('bulk-operation API contract', () => {
    it('derives the public request and response types from the schemas', () => {
        assertType<Equals<BulkOperationPayload, typeof BulkOperationPayloadSchema._output>>(true);
        assertType<Equals<BulkOperationResponse, typeof BulkOperationResponseSchema._output>>(true);
    });

    it('validates the exact published request component', () => {
        const valid = { name: 'change_type', ids: ['6af00dcdd56fe4b74c56e544'], params: { type: 'invoice' } };
        expect(validateApiRequest('BulkOperationPayload', valid).valid).toBe(true);
        expect(validateApiRequest('BulkOperationPayload', { ...valid, extra: true }).valid).toBe(false);
    });

    it('checks each object of a create against the single-create payload', () => {
        const create = (objects: unknown[]) => ({ name: 'create', ids: [], params: { objects } });
        expect(validateApiRequest('BulkOperationPayload', create([{ name: 'n' }])).valid).toBe(true);
        expect(validateApiRequest('BulkOperationPayload', create([null])).valid).toBe(false);
        expect(validateApiRequest('BulkOperationPayload', create([{}])).valid).toBe(false);
    });

    it('requires object IDs in ids for every operation but create', () => {
        const op = (name: string, ids: string[]) => ({ name, ids, params: {} });
        for (const name of ['change_type', 'delete', 'start_workflow', 'update']) {
            expect(validateApiRequest('BulkOperationPayload', op(name, ['6af00dcdd56fe4b74c56e544'])).valid).toBe(true);
            expect(validateApiRequest('BulkOperationPayload', op(name, [''])).valid).toBe(false);
            expect(validateApiRequest('BulkOperationPayload', op(name, ['object-1'])).valid).toBe(false);
        }
        // `create` makes new objects and never reads ids, so the server accepts any string there.
        const create = { name: 'create', ids: [''], params: { objects: [{ name: 'n' }] } };
        expect(validateApiRequest('BulkOperationPayload', create).valid).toBe(true);
    });

    it('enforces the response branch selected by operation', () => {
        expect(
            validateApiResponse('BulkOperationResponse', {
                operation: 'delete',
                status: 'completed',
                deleted: 2,
                failed: [],
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('BulkOperationResponse', {
                operation: 'delete',
                status: 'completed',
                updated: 2,
                failed: [],
            }).valid,
        ).toBe(false);
    });
});
