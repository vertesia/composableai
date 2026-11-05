import { describe, expect, it } from 'vitest';
import { type ApiComponentName, normalizeApiParameters, validateApiRequest } from './registry.js';

/**
 * Query parameters these routes used to read from `ctx.query` without publishing them, so generated clients
 * could not send them: a Go `DeleteApp` could only ever dry-run. The handlers now read the normalized value, so
 * what matters is the text a request carries, which is what these run through the enforcer's own two steps.
 */
function check(component: ApiComponentName, raw: Record<string, string | string[]>) {
    return validateApiRequest(component, normalizeApiParameters(component, raw, 'query').value);
}

function coerced(component: ApiComponentName, raw: Record<string, string | string[]>) {
    const result = check(component, raw);
    expect(result.valid ? [] : result.issues).toEqual([]);
    return result.valid ? result.data : undefined;
}

describe.each([
    ['AppDeleteQuery', 'confirm'],
    ['DeleteInteractionQuery', 'cascade'],
] as const)('%s, whose flag makes a delete remove more', (component, flag) => {
    it('is optional, so the default stays the narrower behavior', () => {
        expect(coerced(component, {})).toEqual({});
    });

    it.each([
        ['true', true],
        ['1', true],
        ['false', false],
        ['0', false],
    ])('reads %s as %s', (text, value) => {
        expect(coerced(component, { [flag]: text })).toEqual({ [flag]: value });
    });

    // A destructive flag must not guess: these delete nothing extra, and they answer 400 instead of doing less
    // than the caller may have meant behind a 200.
    it.each([
        ['a word it does not define', 'yes'],
        ['another casing', 'TRUE'],
        ['a blank value', ''],
        ['a repeated key', ['true', 'true']],
    ])('refuses %s', (_label, text) => {
        expect(check(component, { [flag]: text }).valid).toBe(false);
    });
});

describe.each([['AppRepoCommitsQuery'], ['ListDashboardVersionsQuery'], ['ListDataStoreSchemaHistoryQuery']] as const)(
    '%s limit',
    (component) => {
        it('coerces a whole count to a number', () => {
            expect(coerced(component, { limit: '25' })).toEqual({ limit: 25 });
        });

        it.each(['-1', '1.5', 'many', ''])('refuses %j', (limit) => {
            expect(check(component, { limit }).valid).toBe(false);
        });
    },
);

describe('the remaining parameters', () => {
    it('AppRepoCommitsQuery carries the filters and the cursor as text', () => {
        const query = { path: 'src/main.ts', ref: 'main', cursor: '2' };
        expect(coerced('AppRepoCommitsQuery', query)).toEqual(query);
    });

    it('TerminateAgentRunQuery keeps an empty reason, which still wins over the body', () => {
        expect(coerced('TerminateAgentRunQuery', { reason: '' })).toEqual({ reason: '' });
    });

    it('ListDashboardsQuery takes a lifecycle status only', () => {
        expect(coerced('ListDashboardsQuery', { status: 'archived' })).toEqual({ status: 'archived' });
        expect(check('ListDashboardsQuery', { status: 'all' }).valid).toBe(false);
    });

    it('ListDashboardVersionsQuery coerces snapshots_only', () => {
        expect(coerced('ListDashboardVersionsQuery', { snapshots_only: 'true' })).toEqual({ snapshots_only: true });
    });

    it('GetDataStoreSchemaQuery takes the two formats the handler distinguishes', () => {
        expect(coerced('GetDataStoreSchemaQuery', { format: 'ai' })).toEqual({ format: 'ai' });
        expect(coerced('GetDataStoreSchemaQuery', { format: 'full' })).toEqual({ format: 'full' });
        expect(check('GetDataStoreSchemaQuery', { format: 'data' }).valid).toBe(false);
    });

    it('CreateDataStoreDownloadUrlQuery leaves a version id for the handler to resolve', () => {
        expect(coerced('CreateDataStoreDownloadUrlQuery', { version_id: 'snapshot-1' })).toEqual({
            version_id: 'snapshot-1',
        });
    });
});
