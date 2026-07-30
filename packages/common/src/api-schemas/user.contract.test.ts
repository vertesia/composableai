import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { DeleteByIdResult } from '../common.js';
import type { PrincipalContext, PrincipalIdentity } from '../principal-context.js';
import type { UpdateUserPayload, User } from '../user.js';
import type { JsonObject } from './adapter.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest, validateApiResponse } from './registry.js';
import type {
    DeleteByIdResultFromSchema,
    PrincipalContextFromSchema,
    PrincipalIdentityFromSchema,
    UpdateUserPayloadFromSchema,
    UserArrayFromSchema,
    UserFromSchema,
} from './user.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

function compile(name: string, components: Readonly<Record<string, JsonObject>> = ApiSchemaComponents) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: components } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_USER = {
    id: 'u1',
    email: 'someone@acme.com',
    name: 'Someone',
    created_at: '2026-07-30T10:00:00.000Z',
    updated_at: '2026-07-30T10:00:00.000Z',
};

describe('gate 1 — the schema is the single source of truth for the public IAM types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        assertType<Equals<User, UserFromSchema>>(true);
        assertType<Equals<UserArrayFromSchema, User[]>>(true);
        assertType<Equals<UpdateUserPayload, UpdateUserPayloadFromSchema>>(true);
        assertType<Equals<DeleteByIdResult, DeleteByIdResultFromSchema>>(true);
        assertType<Equals<PrincipalContext, PrincipalContextFromSchema>>(true);
        assertType<Equals<PrincipalIdentity, PrincipalIdentityFromSchema>>(true);
        expect(true).toBe(true);
    });

    it('derives the inherited principal fields rather than restating them', () => {
        // PrincipalIdentity used to `extends PrincipalContext`, so composing the schemas is what
        // keeps the five inherited fields from becoming a twin one level down — the failure mode
        // this batch was scoped to avoid.
        assertType<Equals<PrincipalIdentity['clearance'], PrincipalContext['clearance']>>(true);
        assertType<Equals<PrincipalIdentity['compartments'], PrincipalContext['compartments']>>(true);
        assertType<Equals<PrincipalIdentity['email'], PrincipalContext['email']>>(true);
        assertType<Equals<PrincipalIdentity['tags'], PrincipalContext['tags']>>(true);
        assertType<Equals<PrincipalIdentity['properties'], PrincipalContext['properties']>>(true);
        assertType<Equals<PrincipalIdentity['id'], string>>(true);
        expect(true).toBe(true);
    });

    it('keeps the wire type optionality the document declares', () => {
        assertType<Equals<User['email'], string>>(true);
        assertType<Equals<User['created_at'], string>>(true);
        assertType<Equals<User['source'], 'firebase' | 'scim' | undefined>>(true);
        assertType<Equals<User['clearance'], number | undefined>>(true);
        expect(true).toBe(true);
    });
});

describe('gate 2 — the published components match the closure the types come from', () => {
    it('does not hoist PrincipalContext into a component of its own', () => {
        // It is a public TYPE but has never been a published component. Hoisting it would add a
        // $ref to PrincipalIdentity that every generated client would have to follow.
        expect(Object.keys(ApiSchemaComponents)).not.toContain('PrincipalContext');
        const props = ApiSchemaComponents.PrincipalIdentity.properties as Record<string, JsonObject>;
        expect(props.clearance).toEqual({ type: 'number' });
        expect(props.id).toEqual({ type: 'string' });
    });

    it('publishes the composed property order, id last', () => {
        // `.extend()` appends, which is what `interface … extends …` produced and what the document
        // already carries.
        const props = ApiSchemaComponents.PrincipalIdentity.properties as JsonObject;
        expect(Object.keys(props)).toEqual(['clearance', 'compartments', 'email', 'tags', 'properties', 'id']);
    });

    it('declares the timestamps the endpoint has always shipped', () => {
        // The published component was closed and did not declare these, while the handler
        // serialized the whole Mongo document — so every response violated its own schema.
        const props = ApiSchemaComponents.User.properties as Record<string, JsonObject>;
        expect(props.created_at.type).toBe('string');
        expect(props.updated_at.type).toBe('string');
        expect(ApiSchemaComponents.User.required).toContain('created_at');
        expect(ApiSchemaComponents.User.additionalProperties).toBe(false);
    });
});

describe('gate 3 — AJV validates the same canonical objects that are published', () => {
    it('accepts a minimal user and rejects a missing required field', () => {
        const validate = compile('User');
        expect(validate(VALID_USER)).toBe(true);
        const { created_at: _dropped, ...incomplete } = VALID_USER;
        expect(validate(incomplete)).toBe(false);
    });

    it('rejects a source outside the published enum', () => {
        expect(compile('User')({ ...VALID_USER, source: 'ldap' })).toBe(false);
        expect(compile('User')({ ...VALID_USER, source: 'scim' })).toBe(true);
    });

    it('rejects an undeclared property on the closed user component', () => {
        // Specifically the internal fields a spread of the Mongo document would have leaked.
        expect(compile('User')({ ...VALID_USER, _id: 'deadbeef' })).toBe(false);
    });

    it('accepts an empty update payload but rejects an undeclared field', () => {
        const validate = compile('UpdateUserPayload');
        expect(validate({})).toBe(true);
        expect(validate({ name: 'New name' })).toBe(true);
        // `email` is deliberately not updatable through this endpoint and never has been.
        expect(validate({ email: 'new@acme.com' })).toBe(false);
    });
});

describe('gate 4 — runtime enforcement uses the published components', () => {
    it('rejects an undeclared update field without removing it', () => {
        // The handler used to whitelist fields and silently ignore the rest; the published schema
        // has always said additionalProperties: false. Enforcement makes the two agree.
        const payload: Record<string, unknown> = { name: 'Acme', rogue_field: 42 };
        const result = validateApiRequest('UpdateUserPayload', payload);
        expect(result.valid).toBe(false);
        expect(payload.rogue_field).toBe(42);
    });

    it('accepts a conforming update payload and hands back the component type', () => {
        const result = validateApiRequest('UpdateUserPayload', { name: 'Acme', clearance: 3 });
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, UpdateUserPayload>>(true);
            expect(result.data.clearance).toBe(3);
        }
    });

    it('checks the user response against the same component the SDK type comes from', () => {
        const result = validateApiResponse('User', VALID_USER);
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, User>>(true);
        }
        // A document spread straight onto the wire is what this catches.
        expect(validateApiResponse('User', { ...VALID_USER, _id: 'x' }).valid).toBe(false);
    });

    it('enforces the date-time format the timestamps claim', () => {
        // Through the registry rather than the local `compile` helper: the production validator
        // registers ajv-formats, and a bare Ajv2020 ignores `format` entirely — which is precisely
        // why the description alone was not enough. A plain string schema accepts 'yesterday'.
        expect(validateApiResponse('User', { ...VALID_USER, created_at: 'yesterday' }).valid).toBe(false);
        expect(validateApiResponse('User', { ...VALID_USER, created_at: '2026-07-30' }).valid).toBe(false);
        expect(validateApiResponse('User', VALID_USER).valid).toBe(true);
    });

    it('checks every member of the account listing against the same User component', () => {
        // The gap this closes: `UserArray` items $ref `User`, so publishing the array without
        // enforcing it would document the contract for each member while checking none of them.
        expect(validateApiResponse('UserArray', [VALID_USER, VALID_USER]).valid).toBe(true);
        expect(validateApiResponse('UserArray', []).valid).toBe(true);
        // A legacy member with no timestamps, which is exactly what the old jsonDocs() could emit.
        const { created_at: _dropped, ...legacyMember } = VALID_USER;
        expect(validateApiResponse('UserArray', [VALID_USER, legacyMember]).valid).toBe(false);
        // And one carrying a null the component cannot publish.
        expect(validateApiResponse('UserArray', [{ ...VALID_USER, phone: null }]).valid).toBe(false);
    });

    it('validates the shared DeleteByIdResult that seven other endpoints also publish', () => {
        expect(validateApiResponse('DeleteByIdResult', { id: 'abc' }).valid).toBe(true);
        expect(validateApiResponse('DeleteByIdResult', {}).valid).toBe(false);
    });
});
