import { describe, expect, it } from 'vitest';
import { validateSupportedViewQuery } from './view-query-validation.js';

function deeplyNestedFilter(depth: number): unknown {
    let query: unknown = { term: { status: 'active' } };
    for (let index = 0; index < depth; index++) {
        query = { bool: { filter: query } };
    }
    return query;
}

describe('View query validation', () => {
    it('rejects deeply nested queries without overflowing the call stack', () => {
        expect(() => validateSupportedViewQuery(deeplyNestedFilter(6_000))).not.toThrow();
        expect(validateSupportedViewQuery(deeplyNestedFilter(6_000))).toContainEqual(
            expect.objectContaining({
                message: 'exceeds the maximum of 100 query clauses',
            }),
        );
    });
});
