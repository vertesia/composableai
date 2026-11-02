import { describe, expect, it } from 'vitest';
import { type ApiComponentName, validateApiRequest } from './registry.js';

function valid(component: ApiComponentName, body: unknown): boolean {
    return validateApiRequest(component, body).valid;
}

// The facets of these payloads run as a Mongo `$facet`: a facet name becomes a field name and its field a field path.
describe.each([
    'ComputeCollectionFacetPayload',
    'ComputeInteractionFacetPayload',
    'ComputePromptFacetPayload',
] as const)('%s facets', (component) => {
    const facets = (name: string, field: string) => ({ facets: [{ name, field }] });

    it.each([
        ['a field name and a dotted path', facets('by_type', 'type.name')],
        ['white space', facets(' ', ' ')],
        ['a name ending in a dollar sign', facets('price$', 'price')],
    ])('accept %s', (_case, body) => {
        expect(valid(component, body)).toBe(true);
    });

    it.each([
        ['an empty name', facets('', 'type')],
        ['a dotted name', facets('type.name', 'type')],
        ['a name starting with a dollar sign', facets('$type', 'type')],
        ['a name with NUL', facets('ty\u0000pe', 'type')],
        ['the reserved name', facets('total', 'type')],
        ['an empty field', facets('by_type', '')],
        ['an empty segment', facets('by_type', 'type..name')],
        ['a segment starting with a dollar sign', facets('by_type', 'type.$name')],
        ['a field with NUL', facets('by_type', 'ty\u0000pe')],
    ])('refuse %s', (_case, body) => {
        expect(valid(component, body)).toBe(false);
    });
});

// The ES-backed facets accept dotted names, so the shared FacetSpec does not carry the Mongo rule.
it('leaves the dotted names of the content object facets alone', () => {
    expect(valid('ComputeObjectFacetPayload', { facets: [{ name: 'type.name', field: 'type.name' }] })).toBe(true);
});

describe.each([
    ['FindPayload', (filter: object) => ({ query: filter })],
    ['ComplexCollectionSearchQuery', (filter: object) => ({ match: filter })],
    ['CreateCollectionPayload', (filter: object) => ({ name: 'c', dynamic: true, query: filter })],
    ['UpdateCollectionPayload', (filter: object) => ({ query: filter })],
] as const)('%s filter keys', (component, body) => {
    it.each([
        ['a field', { status: 'ready' }],
        ['a dotted path', { 'properties.region': 'eu' }],
        ['the logical operators', { $and: [{ a: 1 }], $or: [{ b: 1 }], $nor: [{ c: 1 }] }],
        ['white space', { ' ': 1 }],
    ])('accept %s', (_case, filter) => {
        expect(valid(component as ApiComponentName, body(filter))).toBe(true);
    });

    it.each([
        ['an empty key', { '': 1 }],
        ['an operator outside the logical ones', { $where: 'true' }],
        ['an empty segment', { 'a..b': 1 }],
        ['a segment starting with a dollar sign', { 'a.$b': 1 }],
        ['a key with NUL', { 'a\u0000b': 1 }],
    ])('refuse %s', (_case, filter) => {
        expect(valid(component as ApiComponentName, body(filter))).toBe(false);
    });
});
