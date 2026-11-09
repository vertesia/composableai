import { describe, expect, it } from 'vitest';
import { validateApiRequest } from './registry.js';

/**
 * The execution inputs the View execute and preview routes accept, as `validateExecuteViewRequest` bounds them: the
 * keys of the selection maps are group ids, and the maps, their values and the free-text inputs are bounded.
 */
describe('View execution input contract', () => {
    // Search is enabled so the search inputs reach the bounds under test.
    const configuration = { name: 'Contracts', search: {} };
    const cases = [
        ['ExecuteViewRequest', (input: Record<string, unknown>) => input],
        ['PreviewViewExperienceRequest', (input: Record<string, unknown>) => ({ ...input, configuration })],
    ] as const;

    for (const [component, body] of cases) {
        const valid = (input: Record<string, unknown>) => validateApiRequest(component, body(input)).valid;

        it(`${component}: accepts group ids and refuses other keys`, () => {
            expect(valid({ navigation_queries: { 'by-type_2': 'inv' } })).toBe(true);
            expect(valid({ key_terms: { vendor: ['acme'] }, navigation: { status: ['open'] } })).toBe(true);
            expect(valid({ navigation_queries: { Q1: 'inv' } })).toBe(false);
            expect(valid({ navigation_queries: { '': 'inv' } })).toBe(false);
            expect(valid({ key_terms: { '1vendor': ['acme'] } })).toBe(false);
            expect(valid({ navigation: { 'status.open': ['x'] } })).toBe(false);
        });

        it(`${component}: bounds the maps, their values and the free-text inputs`, () => {
            const groups = (count: number) =>
                Object.fromEntries(Array.from({ length: count }, (_, i) => [`g${i}`, []]));
            expect(valid({ navigation: groups(20) })).toBe(true);
            expect(valid({ navigation: groups(21) })).toBe(false);
            expect(valid({ key_terms: groups(51) })).toBe(false);
            expect(valid({ navigation: { status: Array.from({ length: 101 }, () => 'v') } })).toBe(false);
            expect(valid({ navigation: { status: ['v'.repeat(1_001)] } })).toBe(false);
            expect(valid({ navigation_queries: { status: 'q'.repeat(201) } })).toBe(false);
            expect(valid({ query: 'q'.repeat(4_000), display: 'd'.repeat(64), sort: 's'.repeat(64) })).toBe(true);
            expect(valid({ query: 'q'.repeat(4_001) })).toBe(false);
            expect(valid({ display: 'd'.repeat(65) })).toBe(false);
            expect(valid({ sort: 's'.repeat(65) })).toBe(false);
        });
    }

    it('takes search input in a preview only when the configuration enables search', () => {
        const unsearchable = { name: 'Contracts' };
        const preview = (input: Record<string, unknown>, config: Record<string, unknown> = unsearchable) =>
            validateApiRequest('PreviewViewExperienceRequest', { ...input, configuration: config }).valid;
        expect(preview({})).toBe(true);
        expect(preview({ query: ' \n\t' })).toBe(true);
        expect(preview({ key_terms: { vendor: ['', ''] }, navigation: { status: ['open'] } })).toBe(true);
        expect(preview({ query: 'invoices' })).toBe(false);
        expect(preview({ key_terms: { vendor: ['acme'] } })).toBe(false);
        expect(preview({ query: 'invoices', key_terms: { vendor: ['acme'] } }, configuration)).toBe(true);
        // A stored View's execution reads the stored configuration, so the execute request states no such rule.
        expect(validateApiRequest('ExecuteViewRequest', { query: 'invoices' }).valid).toBe(true);
    });

    it('bounds the top level of an inline View configuration as the server does', () => {
        const preview = (config: Record<string, unknown>) =>
            validateApiRequest('PreviewViewExperienceRequest', { configuration: config }).valid;
        expect(preview({ name: 'n'.repeat(120), description: 'd'.repeat(4_000) })).toBe(true);
        expect(preview({ name: '' })).toBe(false);
        expect(preview({ name: 'n'.repeat(121) })).toBe(false);
        expect(preview({ name: 'n', description: 'd'.repeat(4_001) })).toBe(false);
    });
});
