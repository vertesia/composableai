import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { AccountType, BillingMethod } from '../user.js';
import { findUnprunablePaths, type JsonObject, pruneToSchema, toOpenApiComponents } from './adapter.js';
import {
    type ApiComponentType,
    ApiSchemaComponents,
    apiComponentRef,
    pruneAndValidateApiResponse,
    pruneApiResponse,
} from './registry.js';

function compile(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const ACCOUNT: ApiComponentType<'Account'> = {
    id: 'acc_1',
    name: 'Acme',
    email_domains: ['acme.com'],
    onboarding: { completed: true, completed_at: '2026-07-29T10:00:00.000Z' },
    datacenter: 'gcp',
    account_type: AccountType.customer,
    billing: { method: BillingMethod.stripe, stripe_customer_id: 'cus_1' },
    feature_flags: { new_editor: true, beta_agents: 'on' },
    created_by: 'u1',
    updated_by: 'u1',
    created_at: '2026-07-29T10:00:00.000Z',
    updated_at: '2026-07-29T10:00:00.000Z',
};

/**
 * An Account carrying extra runtime fields — what a Mongo document actually is. The cast models
 * the gap the pruner exists to close: the value is typed as the component, but at runtime it has
 * more than the component declares.
 */
const withExtras = (extra: Record<string, unknown>): ApiComponentType<'Account'> =>
    ({ ...ACCOUNT, ...extra }) as ApiComponentType<'Account'>;

describe('response pruning narrows payloads to the published contract', () => {
    it('drops undeclared top-level fields', () => {
        const pruned = pruneApiResponse(
            'Account',
            withExtras({ __v: 3, internal_notes: 'do not ship', stripe_secret: 'sk_live_leak' }),
        );
        expect(pruned).toEqual(ACCOUNT);
        expect('stripe_secret' in pruned).toBe(false);
    });

    it('drops undeclared fields nested inside a declared object', () => {
        const pruned = pruneApiResponse(
            'Account',
            withExtras({
                onboarding: { ...ACCOUNT.onboarding, internal_step: 7 },
                billing: { ...ACCOUNT.billing, stripe_secret_key: 'sk_live_leak' },
            }),
        );
        expect(pruned.onboarding).toEqual(ACCOUNT.onboarding);
        expect(pruned.billing).toEqual(ACCOUNT.billing);
    });

    it('PRESERVES the contents of freeform maps', () => {
        // The regression this design exists to avoid: AJV's removeAdditional:'all' strips keys
        // from objects that declare additionalProperties too, which is how launch_workstream's
        // `data` was emptied. `feature_flags` is `{additionalProperties:{}}` with no `properties`,
        // so every operator flag would vanish under a blanket removal mode.
        const pruned = pruneApiResponse('Account', ACCOUNT);
        expect(pruned.feature_flags).toEqual({ new_editor: true, beta_agents: 'on' });
    });

    it('leaves a conforming payload byte-identical', () => {
        expect(pruneApiResponse('Account', ACCOUNT)).toEqual(ACCOUNT);
    });

    it('never mutates the payload it is given', () => {
        const input = withExtras({ rogue: 1 });
        const pristine = structuredClone(input);
        pruneApiResponse('Account', input);
        expect(input).toEqual(pristine);
    });

    it('produces output that validates against the published schema', () => {
        const validate = compile('Account');
        const pruned = pruneApiResponse('Account', withExtras({ leaked: 'x' }));
        expect(validate(pruned)).toBe(true);
    });

    it('does not throw on a payload that is missing required fields', () => {
        // Pruning is not validation. A malformed document still reaches the client rather than
        // becoming a 500 — surfacing drift is the validator's job, not the pruner's.
        const malformed = { id: 'acc_1', junk: true } as unknown as ApiComponentType<'Account'>;
        expect(() => pruneApiResponse('Account', malformed)).not.toThrow();
        expect(pruneApiResponse('Account', malformed)).toEqual({ id: 'acc_1' });
    });
});

describe('pruneAndValidateApiResponse is the sound entry point for untyped payloads', () => {
    it('returns the component type only on the valid branch', () => {
        const result = pruneAndValidateApiResponse('Account', withExtras({ leaked: 'x' }));
        expect(result.valid).toBe(true);
        if (result.valid) {
            // Reachable as the component type only after validation succeeded.
            const id: string = result.data.id;
            expect(id).toBe('acc_1');
            expect('leaked' in result.data).toBe(false);
        }
    });

    it('reports errors instead of typing an incomplete payload as complete', () => {
        // The unsoundness this replaces: narrowing `{id}` and handing it back as a full Account.
        const result = pruneAndValidateApiResponse('Account', { id: 'acc_1', junk: true });
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.errors.join(' ')).toContain("must have required property 'name'");
            // The pruned value is still available, so the caller chooses ship-and-log or fail.
            expect(result.data).toEqual({ id: 'acc_1' });
        }
    });

    it('flags a legacy account missing created_by/updated_by', () => {
        // Real migration hazard: the Mongo schema declares these without `required`, and the
        // BackfillAccountCreatedBy migration skips ownerless accounts by design.
        const { created_by: _c, updated_by: _u, ...legacy } = ACCOUNT;
        const result = pruneAndValidateApiResponse('Account', legacy);
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.errors.join(' ')).toContain('created_by');
            expect(result.errors.join(' ')).toContain('updated_by');
        }
    });
});

describe('response pruning through structural schema features', () => {
    it('follows the discriminator to the matching union branch', () => {
        const enabled = pruneApiResponse('StripeBillingStatusResponse', {
            status: 'enabled',
            billing_method: 'stripe',
            portal_url: 'https://billing',
            internal_session_id: 'leak',
        } as never);
        expect(enabled).toEqual({ status: 'enabled', billing_method: 'stripe', portal_url: 'https://billing' });

        const disabled = pruneApiResponse('StripeBillingStatusResponse', {
            status: 'disabled',
            billing_method: null,
            reason: 'No billing method',
            internal_trace: 'leak',
        } as never);
        expect(disabled).toEqual({ status: 'disabled', billing_method: null, reason: 'No billing method' });
    });

    it('prunes inside arrays', () => {
        const components = toOpenApiComponents({
            Page: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: { $id: 'Row', type: 'object', properties: { id: { type: 'string' } } },
                    },
                },
            },
        });
        const pruned = pruneToSchema(
            {
                items: [
                    { id: 'a', secret: 1 },
                    { id: 'b', secret: 2 },
                ],
                extra: true,
            },
            { $ref: '#/components/schemas/Page' },
            components,
        ) as JsonObject;
        expect(pruned).toEqual({ items: [{ id: 'a' }, { id: 'b' }] });
    });

    it('leaves ambiguous schemas untouched rather than guessing', () => {
        // An undiscriminated union and an allOf could each drop fields that belong to a branch we
        // cannot identify, so the payload passes through intact.
        const components = toOpenApiComponents({
            Loose: { anyOf: [{ type: 'object', properties: { a: { type: 'string' } } }, { type: 'object' }] },
            Merged: { allOf: [{ type: 'object', properties: { a: { type: 'string' } } }] },
        });
        const payload = { a: 'x', b: 'keep' };
        expect(pruneToSchema(payload, { $ref: '#/components/schemas/Loose' }, components)).toEqual(payload);
        expect(pruneToSchema(payload, { $ref: '#/components/schemas/Merged' }, components)).toEqual(payload);
    });

    it('keeps extras where a component explicitly declares itself extensible', () => {
        const components = toOpenApiComponents({
            Open: { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: true },
        });
        expect(pruneToSchema({ a: 'x', b: 'keep' }, { $ref: '#/components/schemas/Open' }, components)).toEqual({
            a: 'x',
            b: 'keep',
        });
    });

    it('keeps properties documented on a $ref sibling', () => {
        // 2020-12 applies $ref siblings as additional constraints, so `extra` is declared here
        // and must survive pruning rather than being dropped as unknown.
        const components = toOpenApiComponents({
            Wrapper: {
                type: 'object',
                properties: {
                    inner: {
                        $ref: '#/$defs/Base',
                        properties: { extra: { type: 'string' } },
                        required: ['extra'],
                    },
                },
                $defs: { Base: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } },
            },
        });
        const pruned = pruneToSchema(
            { inner: { a: 'x', extra: 'documented', undeclared: 'drop' } },
            { $ref: '#/components/schemas/Wrapper' },
            components,
        );
        expect(pruned).toEqual({ inner: { a: 'x', extra: 'documented' } });
    });

    it('follows a chain of aliased references to the terminal schema', () => {
        // A component that is itself a reference is an alias. Resolving only one hop would leave a
        // node whose `properties` lists just `extra`, so pruning would read that as the entire
        // shape and drop `a` — which Base requires, making the pruned response fail validation.
        const components = toOpenApiComponents({
            Alias: {
                $ref: '#/components/schemas/Base',
                properties: { extra: { type: 'string' } },
                required: ['extra'],
            },
            Base: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        });
        const ref = { $ref: '#/components/schemas/Alias' };

        const pruned = pruneToSchema({ a: 'x', extra: 'documented', undeclared: 'drop' }, ref, components);
        expect(pruned).toEqual({ a: 'x', extra: 'documented' });
        // The detector recurses through references, so it must reach the same terminal schema —
        // a divergence here means it certifies a component the pruner then mangles.
        expect(findUnprunablePaths(ref, components)).toEqual([]);

        const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
        ajv.addSchema({ $id: 'vertesia://chain', components: { schemas: components } });
        expect(ajv.validate({ $ref: 'vertesia://chain#/components/schemas/Alias' }, pruned)).toBe(true);
    });

    it('strips undeclared fields on a component closed with additionalProperties:false', () => {
        const components = toOpenApiComponents(
            { Closed: { type: 'object', properties: { a: { type: 'string' } } } },
            { strictComponents: new Set(['Closed']) },
        );
        expect(pruneToSchema({ a: 'x', b: 'drop' }, { $ref: '#/components/schemas/Closed' }, components)).toEqual({
            a: 'x',
        });
    });
});
