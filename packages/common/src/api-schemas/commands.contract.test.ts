import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from './registry.js';

/**
 * The migration-command contracts, pinned where converting them changed what the document says.
 *
 * Both changes are widenings — every request and response that was valid before is still valid — but
 * both are visible in the generated clients, so each one is asserted here rather than described in a
 * commit message.
 */
describe('RunMigrationPayload', () => {
    it('accepts the params object migrations are actually invoked with', () => {
        // The shape from `migrate-agent-runs`' own usage comment. The published component declared
        // only `force`, so enforcing it closed would have rejected this.
        expect(
            validateApiRequest('RunMigrationPayload', {
                force: true,
                params: { tenantId: 'abc123_def456', since: '2025-01-01' },
            }),
        ).toMatchObject({ valid: true });
    });

    it('still accepts the bare force body, and an empty one', () => {
        expect(validateApiRequest('RunMigrationPayload', { force: true }).valid).toBe(true);
        expect(validateApiRequest('RunMigrationPayload', {}).valid).toBe(true);
    });

    it('rejects an undeclared sibling of params, so the body stays closed', () => {
        // `params` is freeform INSIDE; that is not the same as the body being open. A typo like
        // `parms` has to fail rather than be silently dropped on the floor by the migration.
        const result = validateApiRequest('RunMigrationPayload', { parms: { tenantId: 'x' } });
        expect(result.valid).toBe(false);
        expect(result.valid === false && result.errors.join('; ')).toContain('additional properties');
    });
});

describe('MigrationListResponse', () => {
    it('validates the shape the handler returns', () => {
        expect(
            validateApiResponse('MigrationListResponse', { migrations: [{ name: 'migrate-agent-runs' }] }),
        ).toMatchObject({ valid: true });
    });

    it('rejects a response that is no longer the listing', () => {
        // The point of giving the component a body: as `z.unknown()` every one of these passed, so
        // the endpoint was wired to the enforcer while validating nothing at all.
        expect(validateApiResponse('MigrationListResponse', { migrations: ['a'] }).valid).toBe(false);
        expect(validateApiResponse('MigrationListResponse', { migration: [] }).valid).toBe(false);
        expect(validateApiResponse('MigrationListResponse', ['migrate-agent-runs']).valid).toBe(false);
    });
});
