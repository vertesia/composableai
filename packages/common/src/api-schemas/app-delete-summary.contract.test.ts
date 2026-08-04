import { describe, expect, it } from 'vitest';
import type { AppDeleteSummary } from '../apps.js';
import { AppDeleteSummarySchema } from './app-lifecycle.js';
import { validateApiResponse } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

/**
 * `DeleteApp` published `CountResult` while returning this shape. Response validation therefore
 * reported a missing `count` and every field below as unexpected — and where the check fails closed
 * (local development) that surfaced as a 500 raised AFTER the app had already been deleted, which is
 * the worst possible moment for it. These assertions pin the component to what the handler builds.
 */
const REAL_SUMMARY: AppDeleteSummary = {
    confirmed: true,
    app_id: '68b1779130afe5403a1589bc',
    app_name: 'acme-app',
    versions: 2,
    installations: 1,
    storage_prefix: 'apps/acme-app',
    deleted: true,
    warnings: [],
};

describe('AppDeleteSummary — as the DeleteApp response is validated', () => {
    it('accepts what the handler returns after a confirmed delete', () => {
        expect(validateApiResponse('AppDeleteSummary', REAL_SUMMARY).valid).toBe(true);
    });

    it('accepts the dry-run preview, which is the same shape with deleted: false', () => {
        const preview = { ...REAL_SUMMARY, confirmed: false, deleted: false };
        expect(validateApiResponse('AppDeleteSummary', preview).valid).toBe(true);
    });

    it('accepts a git-backed app, whose summary carries the repo URL', () => {
        const withRepo = { ...REAL_SUMMARY, git_repo_url: 'https://git.example.com/acme/acme-app.git' };
        expect(validateApiResponse('AppDeleteSummary', withRepo).valid).toBe(true);
    });

    it('accepts the warnings a partially-degraded cascade collects', () => {
        const warned = {
            ...REAL_SUMMARY,
            warnings: ['git repo delete failed: 502', 'version cleanup failed: timeout'],
        };
        expect(validateApiResponse('AppDeleteSummary', warned).valid).toBe(true);
    });

    it('is NOT interchangeable with CountResult, the component this endpoint used to publish', () => {
        // The regression in one line: neither validates as the other, so the mismatch was total.
        expect(validateApiResponse('CountResult', REAL_SUMMARY).valid).toBe(false);
        expect(validateApiResponse('AppDeleteSummary', { count: 1 }).valid).toBe(false);
    });

    it('rejects an undeclared field, so the component cannot silently drift from the handler', () => {
        expect(validateApiResponse('AppDeleteSummary', { ...REAL_SUMMARY, secrets_purged: 3 }).valid).toBe(false);
    });

    it('keeps the public type derived from the schema rather than hand-written beside it', () => {
        assertType<Equals<AppDeleteSummary, ReturnType<typeof AppDeleteSummarySchema.parse>>>(true);
        // Every field the handler always sets is required; only git_repo_url is optional.
        expect(AppDeleteSummarySchema.safeParse({ ...REAL_SUMMARY, warnings: undefined }).success).toBe(false);
        const { git_repo_url: _omitted, ...withoutRepo } = { ...REAL_SUMMARY, git_repo_url: 'https://x' };
        expect(AppDeleteSummarySchema.safeParse(withoutRepo).success).toBe(true);
    });
});
