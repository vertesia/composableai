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
        const valid = { name: 'change_type', ids: ['object-1'], params: { type: 'invoice' } };
        expect(validateApiRequest('BulkOperationPayload', valid).valid).toBe(true);
        expect(validateApiRequest('BulkOperationPayload', { ...valid, extra: true }).valid).toBe(false);
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
