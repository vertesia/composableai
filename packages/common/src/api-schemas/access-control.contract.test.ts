import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type {
    ACECreatePayload,
    ACEUpdatePayload,
    AccessControlEntry,
    AceConditions,
    PropertyConditions,
} from '../access-control.js';
import { AccessControlPrincipalType, AccessControlResourceType, Permission } from '../access-control.js';
import type { RoleDefinition, SystemRoleDefinition } from '../roles/types.js';
import type {
    ACECreatePayloadFromSchema,
    ACEUpdatePayloadFromSchema,
    AccessControlEntryArrayFromSchema,
    AccessControlEntryFromSchema,
    AceConditionsFromSchema,
    PropertyConditionsFromSchema,
    RoleDefinitionArrayFromSchema,
    RoleDefinitionFromSchema,
    SystemRoleDefinitionArrayFromSchema,
    SystemRoleDefinitionFromSchema,
} from './access-control.js';
import type { JsonObject } from './adapter.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest, validateApiResponse } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

function compile(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_ACE = {
    id: 'ace1',
    role: 'owner',
    resource_type: AccessControlResourceType.account,
    resource: '68b1779130afe5403a1589ba',
    principal_type: AccessControlPrincipalType.user,
    principal: '68b1779130afe5403a1589bb',
};

const VALID_ROLE = { name: 'owner', permissions: ['account:admin'], domain: 'system' };

describe('gate 1 — the schema is the single source of truth for the public access-control types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        assertType<Equals<AccessControlEntry, AccessControlEntryFromSchema>>(true);
        assertType<Equals<AccessControlEntryArrayFromSchema, AccessControlEntry[]>>(true);
        assertType<Equals<ACECreatePayload, ACECreatePayloadFromSchema>>(true);
        assertType<Equals<ACEUpdatePayload, ACEUpdatePayloadFromSchema>>(true);
        assertType<Equals<AceConditions, AceConditionsFromSchema>>(true);
        assertType<Equals<PropertyConditions, PropertyConditionsFromSchema>>(true);
        assertType<Equals<RoleDefinition, RoleDefinitionFromSchema>>(true);
        assertType<Equals<RoleDefinitionArrayFromSchema, RoleDefinition[]>>(true);
        assertType<Equals<SystemRoleDefinition, SystemRoleDefinitionFromSchema>>(true);
        assertType<Equals<SystemRoleDefinitionArrayFromSchema, SystemRoleDefinition[]>>(true);
        expect(true).toBe(true);
    });

    it('derives both ACE payloads from the entry rather than restating ten fields', () => {
        // `ACECreatePayload extends Omit<AccessControlEntry, 'created_at' | 'updated_at' | 'id'>` is
        // what the hand-written type said; `.omit()` is the literal translation, and the right
        // operator when the derived shape is almost everything.
        assertType<Equals<ACECreatePayload['role'], AccessControlEntry['role']>>(true);
        assertType<Equals<ACECreatePayload['conditions'], AccessControlEntry['conditions']>>(true);
        assertType<Equals<ACEUpdatePayload['role'], string | undefined>>(true);
        // The three server-owned fields are what the omit leaves behind.
        assertType<Equals<Extract<keyof ACECreatePayload, 'id' | 'created_at' | 'updated_at'>, never>>(true);
        expect(true).toBe(true);
    });

    it('narrows permissions on the system role view without restating the shape', () => {
        // `.extend()` overriding one property, which is what `interface SystemRoleDefinition extends
        // RoleDefinition` did. Overriding keeps the property's position, so the published order holds.
        assertType<Equals<SystemRoleDefinition['name'], RoleDefinition['name']>>(true);
        assertType<Equals<SystemRoleDefinition['domain'], RoleDefinition['domain']>>(true);
        assertType<Equals<RoleDefinition['permissions'], string[]>>(true);
        // `SystemRoleDefinition['permissions']` is `Permission[]` — asserted by assignment in both
        // directions rather than by `Equals`, which distinguishes an enum type from the union of its
        // members even though tsc reports them under the same name.
        const fromEnum: SystemRoleDefinition['permissions'] = [Permission.account_admin];
        const toEnum: Permission[] = fromEnum;
        // And it is genuinely narrower than the base component: an ABAC role name is a valid
        // `RoleDefinition` permission and not a valid system one.
        const abac: RoleDefinition['permissions'] = ['content:reader'];
        // @ts-expect-error 'content:reader' is not a Permission
        const rejected: SystemRoleDefinition['permissions'] = abac;
        expect([toEnum, rejected]).toEqual([['account:admin'], ['content:reader']]);
    });
});

describe('gate 2 — the published components match the closure the types come from', () => {
    it('keeps the enums as shared components rather than inlining them per property', () => {
        // A named component becomes ONE reusable Java/Go enum; an inline copy becomes an anonymous
        // type per property. These names are already in the published document, so keeping them is
        // also what avoids a breaking rename for everyone generating from it.
        const props = ApiSchemaComponents.AccessControlEntry.properties as Record<string, JsonObject>;
        expect(props.resource_type).toEqual({ $ref: '#/components/schemas/AccessControlResourceType' });
        expect(props.principal_type).toEqual({ $ref: '#/components/schemas/AccessControlPrincipalType' });
        expect(ApiSchemaComponents.AccessControlResourceType.enum).toContain('content_set');
        expect(ApiSchemaComponents.Permission.enum).toContain('account:admin');
    });

    it('closes AceConditions, which the display-name fields would otherwise slip through', () => {
        // Listed in STRICT_COMPONENTS by name: it is a hoisted component, so the parent entry's
        // strict policy does not reach it.
        expect(ApiSchemaComponents.AceConditions.additionalProperties).toBe(false);
        expect(Object.keys(ApiSchemaComponents.AceConditions.properties as JsonObject)).toEqual([
            'principal_props',
            'resource_props',
            'scope',
        ]);
    });

    it('publishes PropertyConditions as the map it is', () => {
        // It used to be a `$ref` to a synthesized `PropertyConditionValueMap` — an artifact of
        // deriving a `Record<>` alias through a second alias. The indirection is gone; the value
        // schema is still its own component so the "deliberately unconstrained" statement has one
        // place to live.
        expect(ApiSchemaComponents.PropertyConditions.additionalProperties).toEqual({
            $ref: '#/components/schemas/PropertyConditionValue',
        });
        expect(Object.keys(ApiSchemaComponents)).not.toContain('PropertyConditionValueMap');
    });

    it('leaves the ACE timestamps as plain strings', () => {
        // Deliberately NOT tightened to `format: date-time` the way User and UserGroup were:
        // `expires_at` shares the declaration and is written straight from a payload, so a stored
        // value AJV would now reject is a real possibility rather than a hypothetical one.
        const props = ApiSchemaComponents.AccessControlEntry.properties as Record<string, JsonObject>;
        expect(props.created_at).toEqual({ type: 'string' });
        expect(props.expires_at).toEqual({ type: 'string' });
    });
});

describe('gate 3 — AJV validates the same canonical objects that are published', () => {
    it('accepts a minimal entry and rejects a missing required field', () => {
        const validate = compile('AccessControlEntry');
        expect(validate(VALID_ACE)).toBe(true);
        const { principal: _dropped, ...incomplete } = VALID_ACE;
        expect(validate(incomplete)).toBe(false);
    });

    it('rejects the display names the sub-document holds but the contract does not declare', () => {
        const validate = compile('AccessControlEntry');
        expect(validate({ ...VALID_ACE, conditions: { principal_props: { team: 'eng' } } })).toBe(true);
        expect(validate({ ...VALID_ACE, conditions: { principal_name: 'Engineering staff' } })).toBe(false);
        expect(validate({ ...VALID_ACE, conditions: { resource_name: 'Confidential docs' } })).toBe(false);
    });

    it('rejects the internal fields a serialized document would have leaked', () => {
        const validate = compile('AccessControlEntry');
        expect(validate({ ...VALID_ACE, _id: 'deadbeef' })).toBe(false);
        expect(validate({ ...VALID_ACE, type: 'legacy' })).toBe(false);
    });

    it('accepts any condition value, which is the point of leaving it unconstrained', () => {
        const validate = compile('AccessControlEntry');
        for (const value of [5, 'engineering', { $gte: 5 }, ['us-east'], '$principal.access_level', null]) {
            expect(validate({ ...VALID_ACE, conditions: { resource_props: { key: value } } })).toBe(true);
        }
    });

    it('requires the five identifying fields on a create payload and none on an update', () => {
        const create = compile('ACECreatePayload');
        const { id: _id, ...payload } = VALID_ACE;
        expect(create(payload)).toBe(true);
        // `id` and the timestamps are server-owned; the closed payload rejects them outright.
        expect(create(VALID_ACE)).toBe(false);
        expect(create({ role: 'owner' })).toBe(false);

        const update = compile('ACEUpdatePayload');
        expect(update({})).toBe(true);
        expect(update({ role: 'reader' })).toBe(true);
        expect(update({ rogue_field: 1 })).toBe(false);
    });

    it('constrains a system role to the Permission enum and a plain role to any string', () => {
        expect(compile('RoleDefinition')(VALID_ROLE)).toBe(true);
        expect(compile('RoleDefinition')({ ...VALID_ROLE, permissions: ['content:reader'] })).toBe(true);
        expect(compile('SystemRoleDefinition')(VALID_ROLE)).toBe(true);
        // 'content:reader' is an ABAC role name, not a Permission — which is exactly the distinction
        // the two components exist to draw.
        expect(compile('SystemRoleDefinition')({ ...VALID_ROLE, permissions: ['content:reader'] })).toBe(false);
        expect(compile('RoleDefinition')({ ...VALID_ROLE, domain: 'billing' })).toBe(false);
    });
});

describe('gate 4 — runtime enforcement uses the published components', () => {
    it('checks every member of a listing against the same entry component', () => {
        expect(validateApiResponse('AccessControlEntryArray', [VALID_ACE, VALID_ACE]).valid).toBe(true);
        expect(validateApiResponse('AccessControlEntryArray', []).valid).toBe(true);
        // One entry still carrying its display name is what the unmapped listing would have produced.
        const leaked = { ...VALID_ACE, conditions: { principal_name: 'Everyone' } };
        expect(validateApiResponse('AccessControlEntryArray', [VALID_ACE, leaked]).valid).toBe(false);
    });

    it('rejects an undeclared update field without removing it', () => {
        const payload: Record<string, unknown> = { role: 'reader', rogue_field: 42 };
        const result = validateApiRequest('ACEUpdatePayload', payload);
        expect(result.valid).toBe(false);
        expect(payload.rogue_field).toBe(42);
    });

    it('hands back the component type on the valid branch', () => {
        const result = validateApiResponse('AccessControlEntry', VALID_ACE);
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, AccessControlEntry>>(true);
        }
    });

    it('checks the role listings against their own components', () => {
        expect(validateApiResponse('RoleDefinitionArray', [VALID_ROLE]).valid).toBe(true);
        expect(validateApiResponse('SystemRoleDefinitionArray', [VALID_ROLE]).valid).toBe(true);
        expect(validateApiResponse('RoleDefinitionArray', [{ ...VALID_ROLE, domain: 'system', extra: 1 }]).valid).toBe(
            false,
        );
    });
});
