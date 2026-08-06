import { describe, expect, it } from 'vitest';
import { findUnprunablePaths, pruneToSchema, toOpenApiComponents } from './adapter.js';
import { findUnprunableApiPaths } from './registry.js';

/**
 * Pins the shapes where pruning declines to narrow.
 *
 * These are limitations, not bugs: guessing which branch of an ambiguous schema applies risks
 * deleting legitimate data. They are pinned here so the boundary is explicit and cannot be
 * mistaken for a secret-removal guarantee — anything sensitive needs an explicit response mapper
 * or a request/response type split.
 */
describe('shapes where pruning passes values through untouched', () => {
    const SENSITIVE = { a: 'x', stripe_secret: 'sk_live_leak' };

    it('an allOf intersection is not pruned', () => {
        const components = toOpenApiComponents({
            Merged: { allOf: [{ type: 'object', properties: { a: { type: 'string' } } }] },
        });
        expect(pruneToSchema(SENSITIVE, { $ref: '#/components/schemas/Merged' }, components)).toEqual(SENSITIVE);
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Merged' }, components)).toEqual([' (allOf)']);
    });

    it('a union without a discriminator is not pruned', () => {
        const components = toOpenApiComponents({
            Loose: {
                anyOf: [
                    { type: 'object', properties: { a: { type: 'string' } } },
                    { type: 'object', properties: { b: { type: 'string' } } },
                ],
            },
        });
        expect(pruneToSchema(SENSITIVE, { $ref: '#/components/schemas/Loose' }, components)).toEqual(SENSITIVE);
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Loose' }, components)).toEqual([
            ' (union without discriminator)',
        ]);
    });

    it('a discriminator value with no mapping entry is not pruned', () => {
        const components = toOpenApiComponents({
            Union: {
                anyOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }],
                $defs: {
                    A: { type: 'object', properties: { kind: { const: 'a' } }, required: ['kind'] },
                    B: { type: 'object', properties: { kind: { const: 'b' } }, required: ['kind'] },
                },
            },
        });
        const unknownBranch = { kind: 'c', stripe_secret: 'sk_live_leak' };
        expect(pruneToSchema(unknownBranch, { $ref: '#/components/schemas/Union' }, components)).toEqual(unknownBranch);
    });

    it('an unresolvable reference is not pruned', () => {
        expect(pruneToSchema(SENSITIVE, { $ref: '#/components/schemas/Absent' }, {})).toEqual(SENSITIVE);
    });

    it('patternProperties is not pruned — its keys are declared but absent from `properties`', () => {
        const components = toOpenApiComponents({
            Headers: {
                type: 'object',
                properties: { a: { type: 'string' } },
                patternProperties: { '^x-': { type: 'string' } },
            },
        });
        const payload = { a: 'x', 'x-trace': 'declared-by-pattern', stripe_secret: 'sk_live_leak' };
        expect(pruneToSchema(payload, { $ref: '#/components/schemas/Headers' }, components)).toEqual(payload);
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Headers' }, components)).toEqual([
            ' (patternProperties)',
        ]);
    });

    it('prefixItems is not pruned — tuple positions have their own schemas', () => {
        const components = toOpenApiComponents({
            Pair: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'object' }] },
        });
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Pair' }, components)).toEqual([' (prefixItems)']);
    });

    it('a non-composable sibling further down a reference chain is not pruned', () => {
        // The sibling sits on the alias, not on the node being pruned, so it is only visible once
        // the chain is followed. Reporting it as an unresolved reference would send someone
        // looking for a missing component that exists.
        const components = toOpenApiComponents({
            Alias: { $ref: '#/components/schemas/Closed', additionalProperties: true },
            Closed: { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false },
        });
        const ref = { $ref: '#/components/schemas/Alias' };
        expect(pruneToSchema(SENSITIVE, ref, components)).toEqual(SENSITIVE);
        expect(findUnprunablePaths(ref, components)).toEqual([
            ' ($ref with unsupported sibling: additionalProperties)',
        ]);
    });

    it('a reference chain that cycles is not pruned', () => {
        // Mutual aliases never reach a schema describing an object, so there is nothing to narrow
        // against. Following them would loop forever.
        const components = toOpenApiComponents({
            Ping: { $ref: '#/components/schemas/Pong' },
            Pong: { $ref: '#/components/schemas/Ping' },
        });
        const ref = { $ref: '#/components/schemas/Ping' };
        expect(pruneToSchema(SENSITIVE, ref, components)).toEqual(SENSITIVE);
        expect(findUnprunablePaths(ref, components)).toEqual([' (circular $ref)']);
    });

    it('a $ref with a non-composable sibling is not pruned', () => {
        // Siblings apply conjunctively, so a sibling `additionalProperties: true` does NOT reopen
        // a closed target. Composing that correctly is not something to guess at.
        const components = toOpenApiComponents({
            Wrapper: {
                type: 'object',
                properties: { inner: { $ref: '#/$defs/Closed', additionalProperties: true } },
                $defs: {
                    Closed: {
                        type: 'object',
                        properties: { a: { type: 'string' } },
                        additionalProperties: false,
                    },
                },
            },
        });
        const payload = { inner: { a: 'x', stripe_secret: 'sk_live_leak' } };
        expect(pruneToSchema(payload, { $ref: '#/components/schemas/Wrapper' }, components)).toEqual(payload);
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Wrapper' }, components)).toEqual([
            '/inner ($ref with unsupported sibling: additionalProperties)',
        ]);
    });
});

describe('findUnprunablePaths reports where a component is not closed', () => {
    it('returns nothing for the fully prunable Account component', () => {
        expect(findUnprunableApiPaths('Account')).toEqual([]);
    });

    it('returns nothing for the discriminated Stripe union', () => {
        // A discriminated union IS prunable — the discriminator selects the branch.
        expect(findUnprunableApiPaths('StripeBillingStatusResponse')).toEqual([]);
    });

    it('reports the path of a nested ambiguous schema', () => {
        const components = toOpenApiComponents({
            Outer: {
                type: 'object',
                properties: {
                    payload: { allOf: [{ type: 'object', properties: { a: { type: 'string' } } }] },
                    rows: {
                        type: 'array',
                        items: { anyOf: [{ type: 'object' }, { type: 'object', properties: {} }] },
                    },
                },
            },
        });
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Outer' }, components).sort()).toEqual([
            '/payload (allOf)',
            '/rows[] (union without discriminator)',
        ]);
    });

    it('reports an ambiguous schema reached through a map value', () => {
        // additionalProperties is the path every value in a Record<string, T> takes, so its
        // limitations are the map's limitations.
        const components = toOpenApiComponents({
            Registry: {
                type: 'object',
                additionalProperties: { allOf: [{ type: 'object', properties: { a: { type: 'string' } } }] },
            },
        });
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Registry' }, components)).toEqual(['{} (allOf)']);
    });

    it('does not flag a scalar union expressed through references', () => {
        // Every branch resolves to an enum, so there are no properties to narrow and the missing
        // discriminator is irrelevant.
        const components = toOpenApiComponents({
            Choice: {
                anyOf: [{ $ref: '#/$defs/Colour' }, { type: 'null' }],
                $defs: { Colour: { type: 'string', enum: ['red', 'green'] } },
            },
        });
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Choice' }, components)).toEqual([]);
    });

    it('terminates on a recursive component', () => {
        const components = toOpenApiComponents({
            Node: { type: 'object', properties: { children: { type: 'array', items: { $ref: '#' } } } },
        });
        expect(findUnprunablePaths({ $ref: '#/components/schemas/Node' }, components)).toEqual([]);
    });
});
