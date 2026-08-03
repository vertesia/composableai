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

    it('resolves a reference against an external component without republishing it', () => {
        const components = toOpenApiComponents(
            {
                AppManifest: {
                    type: 'object',
                    properties: { settings_schema: { $ref: '#/components/schemas/JSONSchema' } },
                },
            },
            { referenceComponents: { JSONSchema: { type: 'object' } } },
        );

        expect(Object.keys(components)).toEqual(['AppManifest']);
        expect((components.AppManifest.properties as JsonObject).settings_schema).toEqual({
            $ref: '#/components/schemas/JSONSchema',
        });
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
    /**
     * Every root inlines its own copy of the `$defs` closure it reaches, so comparing all of them
     * means walking a shared definition once per referencing root. That is affordable here and not at
     * module load, where it was most of the registry's start-up cost — hence `verifyDuplicates`, and
     * hence the second assertion recording what the default does instead.
     */
    const DISAGREEING_ROOTS = {
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
    };

    it('reports two $defs entries that disagree instead of keeping the first', () => {
        expect(() => toOpenApiComponents(DISAGREEING_ROOTS, { verifyDuplicates: true })).toThrow(SchemaAdapterError);
    });

    it('keeps the first copy when duplicates are not verified', () => {
        const components = toOpenApiComponents(DISAGREEING_ROOTS);
        expect((components.Shared.properties as JsonObject).v).toEqual({ type: 'string' });
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

describe('strictness reaches anonymous nested objects', () => {
    /**
     * Strictness is declared per component, but an object nested inline in one has no name to declare.
     * The TypeScript-derived generator closed every object it emitted, so the document already publishes
     * those inline objects closed — `QuotaStandingResponse.admission` and `.llm` were the first two
     * converted, and leaving them open would have loosened a published contract while reproducing it.
     */
    const nested = {
        Report: {
            type: 'object',
            properties: {
                inline: { type: 'object', properties: { note: { type: 'string' } } },
                deeper: {
                    type: 'array',
                    items: { type: 'object', properties: { value: { type: 'number' } } },
                },
            },
        },
    } as const;

    it('closes an inline object inside a strict component', () => {
        const components = toOpenApiComponents(nested, { strictComponents: new Set(['Report']) });
        const properties = components.Report.properties as Record<string, JsonObject>;
        expect(components.Report.additionalProperties).toBe(false);
        expect(properties.inline.additionalProperties).toBe(false);
    });

    it('closes an inline object nested under array items', () => {
        const components = toOpenApiComponents(nested, { strictComponents: new Set(['Report']) });
        const properties = components.Report.properties as Record<string, JsonObject>;
        expect((properties.deeper.items as JsonObject).additionalProperties).toBe(false);
    });

    it('leaves inline objects open in a component that is not strict', () => {
        const components = toOpenApiComponents(nested);
        const properties = components.Report.properties as Record<string, JsonObject>;
        expect(components.Report.additionalProperties).toBeUndefined();
        expect(properties.inline.additionalProperties).toBeUndefined();
    });

    it('never overwrites an existing additionalProperties', () => {
        // `true` or a subschema is a deliberate statement about the extras — a Record<string, string>
        // value type, say — so replacing it with `false` would reject data the schema explicitly allows.
        const components = toOpenApiComponents(
            {
                Report: {
                    type: 'object',
                    properties: {
                        map: { type: 'object', additionalProperties: { type: 'string' } },
                        open: { type: 'object', additionalProperties: true },
                    },
                },
            },
            { strictComponents: new Set(['Report']) },
        );
        const properties = components.Report.properties as Record<string, JsonObject>;
        expect(properties.map.additionalProperties).toEqual({ type: 'string' });
        expect(properties.open.additionalProperties).toBe(true);
    });

    it('does not close a $ref node, which is governed by its own component', () => {
        const components = toOpenApiComponents(
            {
                Report: {
                    type: 'object',
                    properties: { billing: { $ref: '#/$defs/Billing' } },
                    $defs: { Billing: { $id: 'Billing', type: 'object', properties: {} } },
                },
            },
            { strictComponents: new Set(['Report']) },
        );
        const properties = components.Report.properties as Record<string, JsonObject>;
        expect(Object.keys(properties.billing)).toEqual(['$ref']);
        // Billing was not listed, so it stays open.
        expect(components.Billing.additionalProperties).toBeUndefined();
    });
});

describe('description is emitted last', () => {
    /**
     * Key order carries no meaning to a consumer, but it decides byte-identity — which is how a
     * conversion proves it reproduced the published contract rather than renegotiating it. The
     * scanner's TypeScript-derived output puts `description` last, so matching it is what lets a
     * converted component diff clean.
     */
    it('puts description after a sibling $ref', () => {
        const components = toOpenApiComponents({
            Account: {
                type: 'object',
                properties: { tier: { description: 'The tier.', $ref: '#/$defs/Tier' } },
                $defs: { Tier: { $id: 'Tier', type: 'string' } },
            },
        });
        const properties = components.Account.properties as Record<string, JsonObject>;
        expect(Object.keys(properties.tier)).toEqual(['$ref', 'description']);
    });

    it('puts description after the additionalProperties the strict policy appends', () => {
        const components = toOpenApiComponents(
            { Payload: { type: 'object', description: 'A payload.', properties: { a: { type: 'string' } } } },
            { strictComponents: new Set(['Payload']) },
        );
        // Declared as `type, description, properties`; the strict policy appends additionalProperties,
        // and description then moves behind it.
        expect(Object.keys(components.Payload)).toEqual(['type', 'properties', 'additionalProperties', 'description']);
    });

    it('does not reorder a property NAMED description', () => {
        // The trap a generic "walk every object" pass falls into: `properties` keys are user data, and
        // five published components have a property called `description`. Moving it would change the
        // published property order.
        const components = toOpenApiComponents({
            Project: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    description: { type: 'string' },
                    account: { type: 'string' },
                },
            },
        });
        expect(Object.keys(components.Project.properties as JsonObject)).toEqual(['id', 'description', 'account']);
    });

    it('leaves a description that is already last alone', () => {
        const components = toOpenApiComponents({ Tier: { type: 'string', description: 'A tier.' } });
        expect(Object.keys(components.Tier)).toEqual(['type', 'description']);
    });
});

describe('hoisting a union and its members', () => {
    /**
     * A discriminated union's `discriminator` is SYNTHESIZED from its members, so the members have to
     * be registered before the union that references them. `$defs` order is whatever Zod emitted, and
     * the same union is routinely reachable from two roots — once where its members happen to come
     * first and once where they do not. Hoisting in declaration order made those two emissions differ,
     * and the adapter then reported a component "defined twice with different shapes" that nobody had
     * defined twice. `EmbeddingsApiInput` was the first to hit it.
     */
    const MEMBERS = {
        Text: { $id: 'Text', type: 'object', properties: { kind: { const: 'text' } }, required: ['kind'] },
        Image: { $id: 'Image', type: 'object', properties: { kind: { const: 'image' } }, required: ['kind'] },
    };
    const UNION = { $id: 'Input', anyOf: [{ $ref: '#/$defs/Text' }, { $ref: '#/$defs/Image' }] };

    it('synthesizes the discriminator whichever order $defs lists them in', () => {
        const unionFirst = toOpenApiComponents({
            Request: {
                type: 'object',
                properties: { input: { $ref: '#/$defs/Input' } },
                $defs: { Input: UNION, ...MEMBERS },
            },
        });
        const membersFirst = toOpenApiComponents({
            Request: {
                type: 'object',
                properties: { input: { $ref: '#/$defs/Input' } },
                $defs: { ...MEMBERS, Input: UNION },
            },
        });

        expect(unionFirst.Input).toEqual(membersFirst.Input);
        expect(unionFirst.Input).toMatchObject({ discriminator: { propertyName: 'kind' }, required: ['kind'] });
    });

    it('emits the same union from a root that declares it and a root that references it', () => {
        // The shape that actually threw: one root IS the union, another reaches it through a property.
        // `register` compares fingerprints, so two spellings of the same component are a hard failure.
        expect(() =>
            toOpenApiComponents({
                Request: {
                    type: 'object',
                    properties: { input: { $ref: '#/$defs/Input' } },
                    $defs: { Input: UNION, ...MEMBERS },
                },
                Input: { ...UNION, $defs: MEMBERS },
            }),
        ).not.toThrow();
    });
});
