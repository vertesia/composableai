import { describe, expect, it } from 'vitest';
import { type JsonObject, SchemaAdapterError, toOpenApiComponents } from './adapter.js';

describe('reference integrity', () => {
    it('rejects a reference to a component that does not exist', () => {
        // A dangling pointer produces a spec that validates structurally but breaks every
        // generated client at deserialization time.
        expect(() =>
            toOpenApiComponents({
                Account: { type: 'object', properties: { billing: { $ref: '#/$defs/Missing' } } },
            }),
        ).toThrow(SchemaAdapterError);
    });

    it('accepts a reference once its target is defined', () => {
        const components = toOpenApiComponents({
            Account: {
                type: 'object',
                properties: { billing: { $ref: '#/$defs/AccountBilling' } },
                $defs: { AccountBilling: { type: 'object', properties: { method: { type: 'string' } } } },
            },
        });
        expect(Object.keys(components).sort()).toEqual(['Account', 'AccountBilling']);
    });
});

describe('additionalProperties policy', () => {
    it('preserves a schema-valued additionalProperties on an open component', () => {
        // Record<string, string> — deleting the keyword would widen the value type to `any`.
        const components = toOpenApiComponents({
            StringMap: { type: 'object', additionalProperties: { type: 'string' } },
        });
        expect(components.StringMap.additionalProperties).toEqual({ type: 'string' });
    });

    it('preserves additionalProperties:true on an open component', () => {
        const components = toOpenApiComponents({
            Freeform: { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: true },
        });
        expect(components.Freeform.additionalProperties).toBe(true);
    });

    it('removes only an inherited additionalProperties:false', () => {
        const components = toOpenApiComponents({
            Closed: { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false },
        });
        expect(components.Closed.additionalProperties).toBeUndefined();
    });
});

describe('conflicting definitions', () => {
    it('reports two $defs entries that disagree instead of keeping the first', () => {
        expect(() =>
            toOpenApiComponents({
                A: {
                    type: 'object',
                    properties: { x: { $ref: '#/$defs/Shared' } },
                    $defs: { Shared: { type: 'object', properties: { v: { type: 'string' } } } },
                },
                B: {
                    type: 'object',
                    properties: { y: { $ref: '#/$defs/Shared' } },
                    $defs: { Shared: { type: 'object', properties: { v: { type: 'number' } } } },
                },
            }),
        ).toThrow(SchemaAdapterError);
    });

    it('accepts two $defs entries that agree', () => {
        const shared = { type: 'object', properties: { v: { type: 'string' } } };
        const components = toOpenApiComponents({
            A: { type: 'object', properties: { x: { $ref: '#/$defs/Shared' } }, $defs: { Shared: shared } },
            B: { type: 'object', properties: { y: { $ref: '#/$defs/Shared' } }, $defs: { Shared: shared } },
        });
        expect(components.Shared).toEqual(shared);
    });
});

describe('$ref siblings', () => {
    it('keeps sibling keywords alongside a rewritten reference', () => {
        // 2020-12 allows annotations next to $ref; dropping them loses documentation and
        // constraints that generated clients surface.
        const components = toOpenApiComponents({
            Account: {
                type: 'object',
                properties: {
                    billing: {
                        $ref: '#/$defs/AccountBilling',
                        description: 'Billing configuration',
                        deprecated: true,
                    },
                },
                $defs: { AccountBilling: { type: 'object', properties: { method: { type: 'string' } } } },
            },
        });
        expect((components.Account.properties as JsonObject).billing).toEqual({
            $ref: '#/components/schemas/AccountBilling',
            description: 'Billing configuration',
            deprecated: true,
        });
    });
});

describe('reference scope', () => {
    it('resolves a self-reference inside a nested $id to that nested component', () => {
        // `{"$ref": "#"}` inside Child means Child, not the enclosing Account.
        const components = toOpenApiComponents({
            Account: {
                type: 'object',
                properties: {
                    child: {
                        $id: 'Child',
                        type: 'object',
                        properties: { next: { $ref: '#' } },
                    },
                },
            },
        });
        const child = components.Child.properties as JsonObject;
        expect(child.next).toEqual({ $ref: '#/components/schemas/Child' });
        expect(child.next).not.toEqual({ $ref: '#/components/schemas/Account' });
    });

    it('still resolves a root-level self-reference to the root', () => {
        const components = toOpenApiComponents({
            Node: { type: 'object', properties: { children: { type: 'array', items: { $ref: '#' } } } },
        });
        const props = components.Node.properties as JsonObject;
        expect((props.children as JsonObject).items).toEqual({ $ref: '#/components/schemas/Node' });
    });
});

describe('discriminator synthesis', () => {
    it('does not synthesize a discriminator from an optional property', () => {
        // OpenAPI treats the discriminator as always present; promoting an optional property
        // would publish a guarantee the schema does not make.
        const components = toOpenApiComponents({
            Union: {
                anyOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }],
                $defs: {
                    A: { type: 'object', properties: { kind: { const: 'a' } } },
                    B: { type: 'object', properties: { kind: { const: 'b' } } },
                },
            },
        });
        expect(components.Union.discriminator).toBeUndefined();
        expect(components.Union.anyOf).toBeDefined();
    });

    it('synthesizes a discriminator when the property is required in every branch', () => {
        const components = toOpenApiComponents({
            Union: {
                anyOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }],
                $defs: {
                    A: { type: 'object', properties: { kind: { const: 'a' } }, required: ['kind'] },
                    B: { type: 'object', properties: { kind: { const: 'b' } }, required: ['kind'] },
                },
            },
        });
        expect(components.Union.discriminator).toEqual({
            propertyName: 'kind',
            mapping: { a: '#/components/schemas/A', b: '#/components/schemas/B' },
        });
        // Promoted to oneOf, which is what codegen needs.
        expect(components.Union.oneOf).toBeDefined();
        expect(components.Union.anyOf).toBeUndefined();
    });

    it('does not synthesize when two branches claim the same literal', () => {
        const components = toOpenApiComponents({
            Union: {
                anyOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }],
                $defs: {
                    A: { type: 'object', properties: { kind: { const: 'same' } }, required: ['kind'] },
                    B: { type: 'object', properties: { kind: { const: 'same' } }, required: ['kind'] },
                },
            },
        });
        expect(components.Union.discriminator).toBeUndefined();
    });
});
