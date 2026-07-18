import { describe, expect, it } from 'vitest';
import { canonicalizeViewState, parseViewState, serializeViewState } from './viewState.js';

describe('View URL state', () => {
    it('parses repeated key terms and navigation values', () => {
        expect(
            parseViewState(
                '?q=find+contracts&t.party=Acme&t.party=Globex&n.brand=Vertesia&display=cards&sort=updated&offset=20',
            ),
        ).toEqual({
            query: 'find contracts',
            key_terms: { party: ['Acme', 'Globex'] },
            navigation: { brand: ['Vertesia'] },
            display: 'cards',
            sort: 'updated',
            offset: 20,
        });
    });

    it('round trips View state and preserves unrelated host parameters', () => {
        const serialized = serializeViewState(
            {
                query: 'renewal rights',
                key_terms: { party: ['Acme'], topic: ['renewal'] },
                navigation: { location: ['/Customers/Acme'], brand: ['Contoso', 'Vertesia'] },
                display: 'table',
            },
            '?account=account-1&project=project-1&q=stale&n.brand=stale',
        );

        expect(serialized).toContain('account=account-1');
        expect(serialized).toContain('project=project-1');
        expect(parseViewState(serialized)).toEqual({
            query: 'renewal rights',
            key_terms: { party: ['Acme'], topic: ['renewal'] },
            navigation: { brand: ['Contoso', 'Vertesia'], location: ['/Customers/Acme'] },
            display: 'table',
        });
    });

    it('drops malformed offsets and empty values', () => {
        expect(parseViewState('?offset=-2&q=++&n.brand=&t.party=')).toEqual({});
    });

    it('canonicalizes stale configuration IDs from the runtime response', () => {
        expect(
            canonicalizeViewState(
                {
                    query: '  contracts  ',
                    key_terms: { party: ['Acme'], retired: ['old'] },
                    navigation: { brand: ['stale'], retired: ['old'] },
                    display: 'retired',
                    sort: 'retired',
                    offset: 20,
                },
                {
                    view: 'document-lib',
                    revision: 2,
                    definition: {
                        name: 'Documents',
                        search: { key_terms: [{ id: 'party', label: 'Party', type: 'keyword' }] },
                    },
                    display: 'table',
                    sort: 'updated',
                    search: { requested_mode: 'agentic', applied_mode: 'query', warnings: [] },
                    hits: [],
                    total: 0,
                    navigation: {
                        brand: { id: 'brand', selected: ['Acme'], nodes: [] },
                    },
                    took: 5,
                },
            ),
        ).toEqual({
            query: 'contracts',
            key_terms: { party: ['Acme'] },
            navigation: { brand: ['Acme'] },
            display: 'table',
            sort: 'updated',
            offset: 20,
        });
    });
});
