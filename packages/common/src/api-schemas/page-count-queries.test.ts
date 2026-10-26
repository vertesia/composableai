import { describe, expect, it } from 'vitest';
import { validateApiRequest } from '../api-contract/index.js';

// The list contracts whose `limit`/`offset` reach a Mongo `$skip`/`$limit` stage, a find `skip` or an analytics
// query's LIMIT/OFFSET, where a fraction or a negative count failed as a 500. `PageCountSchema` makes the
// contract enforcer answer 400.
const PAGED_COMPONENTS = [
    'ListTasksQuery',
    'ListAgentRunsQuery',
    'InteractionEndpointQuery',
    'RunSearchPayload',
    'ComplexCollectionSearchQuery',
    'CollectionMembersQuery',
    'ContentObjectTypeCatalogQuery',
    'ContentObjectTypeListQuery',
    'PromptSearchQuery',
    'AuditTrailQuery',
] as const;

describe('paged list contracts', () => {
    // Published as `integer` before `PageCountSchema` existed, so it keeps that type and takes only the bound.
    it('RunListQuery accepts non-negative integers only', () => {
        expect(validateApiRequest('RunListQuery', { limit: 0, offset: 20 }).valid).toBe(true);
        expect(validateApiRequest('RunListQuery', { offset: -1 }).valid).toBe(false);
        expect(validateApiRequest('RunListQuery', { limit: -9007199254740991 }).valid).toBe(false);
        expect(validateApiRequest('RunListQuery', { offset: 1.2 }).valid).toBe(false);
    });

    it.each(PAGED_COMPONENTS)('%s accepts whole, non-negative counts only', (component) => {
        expect(validateApiRequest(component, { limit: 0, offset: 20 }).valid).toBe(true);
        expect(validateApiRequest(component, { limit: 1.2 }).valid).toBe(false);
        expect(validateApiRequest(component, { offset: 1.2 }).valid).toBe(false);
        expect(validateApiRequest(component, { offset: -1 }).valid).toBe(false);
        expect(validateApiRequest(component, { limit: -1 }).valid).toBe(false);
    });
});
