import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type {
    ApiKey,
    ApiKeyListQuery,
    ApiKeyReadQuery,
    ApiKeyReadResponse,
    ApiKeyWithValue,
    AuthTokenResponse,
    CreateApiKeyPayload,
    UpdateApiKeyPayload,
} from '../apikey.js';
import { ApiKeyTypes } from '../apikey.js';
import type { ProjectRef } from '../project.js';
import { SystemRoles } from '../project.js';
import type { JsonObject } from './adapter.js';
import type {
    ApiKeyArrayFromSchema,
    ApiKeyFromSchema,
    ApiKeyListQueryFromSchema,
    ApiKeyReadQueryFromSchema,
    ApiKeyReadResponseFromSchema,
    ApiKeyWithValueFromSchema,
    AuthTokenResponseFromSchema,
    CreateApiKeyPayloadFromSchema,
    ProjectRefArrayFromSchema,
    ProjectRefFromSchema,
    UpdateApiKeyPayloadFromSchema,
} from './apikey.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest, validateApiResponse } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

function compile(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_PROJECT_REF = {
    id: '69d4762f24d3048c99149d0b',
    name: 'Research',
    account: '68b1779130afe5403a1589ba',
};

const VALID_KEY = {
    id: '68b1779130afe5403a1589bc',
    name: 'CI',
    type: ApiKeyTypes.secret,
    role: SystemRoles.developer,
    account: '68b1779130afe5403a1589ba',
    project: VALID_PROJECT_REF,
    enabled: true,
    created_by: 'ada@acme.test',
    updated_by: 'ada@acme.test',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
};

describe('gate 1 — the schema is the single source of truth for the public API key types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        assertType<Equals<ApiKey, ApiKeyFromSchema>>(true);
        assertType<Equals<ApiKeyArrayFromSchema, ApiKey[]>>(true);
        assertType<Equals<ApiKeyWithValue, ApiKeyWithValueFromSchema>>(true);
        assertType<Equals<ApiKeyReadResponse, ApiKeyReadResponseFromSchema>>(true);
        assertType<Equals<CreateApiKeyPayload, CreateApiKeyPayloadFromSchema>>(true);
        assertType<Equals<UpdateApiKeyPayload, UpdateApiKeyPayloadFromSchema>>(true);
        assertType<Equals<AuthTokenResponse, AuthTokenResponseFromSchema>>(true);
        assertType<Equals<ApiKeyListQuery, ApiKeyListQueryFromSchema>>(true);
        assertType<Equals<ApiKeyReadQuery, ApiKeyReadQueryFromSchema>>(true);
        assertType<Equals<ProjectRef, ProjectRefFromSchema>>(true);
        assertType<Equals<ProjectRefArrayFromSchema, ProjectRef[]>>(true);
        expect(true).toBe(true);
    });

    it('types the timestamps as strings, which is what the document always published', () => {
        // The hand-written `ApiKey` said `Date` for all three. JSON has no date type and the
        // component has always declared `format: date-time`, so the old declaration described the
        // Mongoose document, not the response — the same correction `User` and `UserGroup` needed.
        assertType<Equals<ApiKey['created_at'], string>>(true);
        assertType<Equals<ApiKey['updated_at'], string>>(true);
        assertType<Equals<ApiKey['expires_at'], string | undefined>>(true);
        expect(true).toBe(true);
    });

    it('keeps the secret off the base type and derives the two shapes that carry it', () => {
        // `value` is absent from `ApiKey` entirely, so a handler cannot leak a secret by returning
        // the wrong shape — it has to name a component that declares one.
        assertType<Equals<Extract<keyof ApiKey, 'value'>, never>>(true);
        // Creation always returns the secret; the single-key read returns it only when asked for it
        // AND permitted, which is why the two cannot share a component.
        assertType<Equals<ApiKeyWithValue['value'], string>>(true);
        assertType<Equals<ApiKeyReadResponse['value'], string | undefined>>(true);
        // Everything else is inherited rather than restated.
        assertType<Equals<ApiKeyWithValue['project'], ApiKey['project']>>(true);
        assertType<Equals<ApiKeyReadResponse['role'], ApiKey['role']>>(true);
        expect(true).toBe(true);
    });

    it('gives create and update the different payloads the two operations actually have', () => {
        // Both pick from `ApiKeySchema`, so a field's type and documentation keep one home; what
        // differs is requiredness and which fields are writable at all — the only two things a write
        // payload legitimately changes about a field it shares.
        // Compared against `ApiKey`, not against the enums directly: the claim is that the payloads
        // are PICKED from the key, so the identity that matters is with the field they came from.
        assertType<Equals<CreateApiKeyPayload['name'], ApiKey['name']>>(true);
        assertType<Equals<CreateApiKeyPayload['role'], ApiKey['role']>>(true);
        assertType<Equals<CreateApiKeyPayload['type'], ApiKey['type'] | undefined>>(true);
        assertType<Equals<CreateApiKeyPayload['expires_at'], ApiKey['expires_at']>>(true);
        assertType<Equals<UpdateApiKeyPayload['name'], ApiKey['name'] | undefined>>(true);
        assertType<Equals<UpdateApiKeyPayload['role'], ApiKey['role'] | undefined>>(true);
        assertType<Equals<UpdateApiKeyPayload['enabled'], ApiKey['enabled'] | undefined>>(true);
        // `name` and `role` are required on create and optional on update — the only difference a
        // write payload legitimately introduces.
        assertType<Equals<CreateApiKeyPayload['name'], string>>(true);
        assertType<Equals<UpdateApiKeyPayload['name'], string | undefined>>(true);

        // What the picks leave out is the whitelist, and it is now an explicit list rather than a
        // consequence of `Partial<ApiKey>`: the server-owned fields are unreachable from either.
        assertType<Equals<Extract<keyof CreateApiKeyPayload, 'id' | 'account' | 'maskedValue'>, never>>(true);
        assertType<Equals<Extract<keyof CreateApiKeyPayload, 'created_at' | 'enabled' | 'project'>, never>>(true);
        // `type` and `expires_at` are immutable after creation, so update cannot name them.
        assertType<Equals<Extract<keyof UpdateApiKeyPayload, 'type' | 'expires_at'>, never>>(true);
        expect(true).toBe(true);
    });
});

describe('gate 2 — the published components match the closure the types come from', () => {
    it('publishes the single-member key type as a const, not a one-member enum', () => {
        // Both validate identically; only one is byte-identical to what the TypeScript scanner
        // emitted, and slots that have not converted still derive this component — the generator
        // fails the build if the two definitions disagree.
        expect(ApiSchemaComponents.ApiKeyTypes).toEqual({ type: 'string', const: 'sk' });
    });

    it('keeps ProjectRef and SystemRoles as shared components rather than inlining them', () => {
        const props = ApiSchemaComponents.ApiKey.properties as Record<string, JsonObject>;
        expect(props.project).toEqual({ $ref: '#/components/schemas/ProjectRef' });
        expect(props.role).toEqual({ $ref: '#/components/schemas/SystemRoles' });
        expect(props.type).toEqual({ $ref: '#/components/schemas/ApiKeyTypes' });
        expect(ApiSchemaComponents.SystemRoles.enum).toContain('content_superadmin');
    });

    it('tightens the API key timestamps to date-time, unlike the ACE ones', () => {
        // Safe here in a way it was not for an access control entry: every one of these is written
        // by the server. `expires_at` too — it is computed from a TTL, never copied out of a payload.
        const props = ApiSchemaComponents.ApiKey.properties as Record<string, JsonObject>;
        expect(props.created_at).toEqual({ type: 'string', format: 'date-time' });
        expect(props.updated_at).toEqual({ type: 'string', format: 'date-time' });
        expect(props.expires_at).toEqual({ type: 'string', format: 'date-time' });
    });

    it('does not declare value on the base component', () => {
        expect(Object.keys(ApiSchemaComponents.ApiKey.properties as JsonObject)).not.toContain('value');
        expect(ApiSchemaComponents.ApiKey.additionalProperties).toBe(false);
        expect((ApiSchemaComponents.ApiKeyWithValue.required as string[]) ?? []).toContain('value');
        expect((ApiSchemaComponents.ApiKeyReadResponse.required as string[]) ?? []).not.toContain('value');
    });

    it('publishes ProjectRef closed, with the documentation the list endpoints rely on', () => {
        const props = ApiSchemaComponents.ProjectRef.properties as Record<string, JsonObject>;
        expect(ApiSchemaComponents.ProjectRef.additionalProperties).toBe(false);
        expect(props.restricted.description).toContain('org admin or owner');
        expect(ApiSchemaComponents.ProjectRef.required).toEqual(['id', 'name', 'account']);
    });
});

describe('gate 3 — AJV validates the same canonical objects that are published', () => {
    it('accepts a minimal key and rejects a missing required field', () => {
        const validate = compile('ApiKey');
        expect(validate(VALID_KEY)).toBe(true);
        const { project: _dropped, ...incomplete } = VALID_KEY;
        expect(validate(incomplete)).toBe(false);
    });

    it('rejects a base key response that carries a secret', () => {
        // The point of splitting the components: a handler that returns the wrong one is caught at
        // the boundary rather than shipping the secret.
        expect(compile('ApiKey')({ ...VALID_KEY, value: 'sk-live-abcdef' })).toBe(false);
        expect(compile('ApiKeyWithValue')({ ...VALID_KEY, value: 'sk-live-abcdef' })).toBe(true);
        expect(compile('ApiKeyReadResponse')({ ...VALID_KEY, value: 'sk-live-abcdef' })).toBe(true);
        expect(compile('ApiKeyReadResponse')(VALID_KEY)).toBe(true);
        // ...and one that omits it where it is promised.
        expect(compile('ApiKeyWithValue')(VALID_KEY)).toBe(false);
    });

    it('rejects a Date where the contract declares a date-time string', () => {
        // What `jsonDoc()` produced before `toApiKeyResponse` existed: `toJSON()` leaves `Date`
        // objects in place, and only `JSON.stringify` converts them — after the enforcer has run.
        // A `Date` fails on `type: string` alone, so this holds with or without format assertion.
        expect(compile('ApiKey')({ ...VALID_KEY, created_at: new Date('2026-01-01T00:00:00.000Z') })).toBe(false);
    });

    it('enforces the date-time format through the registry validator, which is what registers formats', () => {
        // The local `compile()` above deliberately does NOT add ajv-formats — it exists to check the
        // published SHAPE. `format` is only asserted by the production validator, so a malformed
        // timestamp has to be checked there or the assertion would pass vacuously.
        expect(validateApiResponse('ApiKey', { ...VALID_KEY, created_at: 'last tuesday' }).valid).toBe(false);
        expect(validateApiResponse('ApiKey', VALID_KEY).valid).toBe(true);
    });

    it('rejects the internal fields a serialized document would have leaked', () => {
        const validate = compile('ApiKey');
        expect(validate({ ...VALID_KEY, _id: 'deadbeef' })).toBe(false);
        expect(validate({ ...VALID_KEY, hashed_value: 'deadbeef' })).toBe(false);
    });

    it('constrains the key type and the role to their catalogs', () => {
        const validate = compile('ApiKey');
        expect(validate({ ...VALID_KEY, type: 'pk' })).toBe(false);
        expect(validate({ ...VALID_KEY, role: 'superuser' })).toBe(false);
        expect(validate({ ...VALID_KEY, role: SystemRoles.content_superadmin })).toBe(true);
    });

    it('requires name and role on a create, which the handler needed and the payload never said', () => {
        const validate = compile('CreateApiKeyPayload');
        expect(validate({ name: 'CI', role: SystemRoles.reader })).toBe(true);
        expect(validate({ name: 'CI', role: SystemRoles.reader, type: 'sk', expires_at: '2030-01-01T00:00:00Z' })).toBe(
            true,
        );
        // `role` is `required: true` on the Mongoose schema: this used to be accepted here and fail
        // inside `ApiKeyModel.create`, which the endpoint reported as a 500.
        expect(validate({ name: 'CI' })).toBe(false);
        // `name` is required by the published `ApiKey` component, so a key created without one could
        // not produce a conforming response.
        expect(validate({ role: SystemRoles.reader })).toBe(false);
        expect(validate({})).toBe(false);
        // Server-owned fields are no longer declared, so sending one is now an error rather than
        // silently ignored.
        expect(validate({ name: 'CI', role: SystemRoles.reader, id: 'x' })).toBe(false);
        expect(validate({ name: 'CI', role: SystemRoles.reader, enabled: true })).toBe(false);
        expect(validate({ name: 'CI', role: SystemRoles.reader, project: VALID_PROJECT_REF })).toBe(false);
    });

    it('accepts a partial update and rejects the fields creation owns', () => {
        const validate = compile('UpdateApiKeyPayload');
        expect(validate({})).toBe(true);
        expect(validate({ enabled: false })).toBe(true);
        expect(validate({ name: 'CI', role: SystemRoles.reader, enabled: true })).toBe(true);
        expect(validate({ role: 'superuser' })).toBe(false);
        // Immutable after creation.
        expect(validate({ type: 'sk' })).toBe(false);
        expect(validate({ expires_at: '2030-01-01T00:00:00Z' })).toBe(false);
        expect(validate({ rogue_field: 1 })).toBe(false);
    });

    it('validates the two query components the scanner expands into parameters', () => {
        expect(compile('ApiKeyListQuery')({ level: 'project' })).toBe(true);
        expect(compile('ApiKeyListQuery')({})).toBe(true);
        expect(compile('ApiKeyListQuery')({ level: 'organization' })).toBe(false);
        expect(compile('ApiKeyReadQuery')({ withValue: true })).toBe(true);
        expect(compile('ApiKeyReadQuery')({ withValue: 'yes' })).toBe(false);
    });
});

describe('gate 4 — runtime enforcement uses the published components', () => {
    it('checks every member of a listing against the same key component', () => {
        expect(validateApiResponse('ApiKeyArray', [VALID_KEY, VALID_KEY]).valid).toBe(true);
        expect(validateApiResponse('ApiKeyArray', []).valid).toBe(true);
        // One key in the listing still carrying its secret is exactly what the fail-closed boundary
        // in `toApiKeyResponse` exists to make impossible.
        expect(validateApiResponse('ApiKeyArray', [VALID_KEY, { ...VALID_KEY, value: 'sk-leak' }]).valid).toBe(false);
    });

    it('rejects an undeclared payload field without removing it', () => {
        const payload: Record<string, unknown> = { name: 'CI', role: SystemRoles.reader, rogue_field: 42 };
        const result = validateApiRequest('CreateApiKeyPayload', payload);
        expect(result.valid).toBe(false);
        expect(payload.rogue_field).toBe(42);
    });

    it('hands back the component type on the valid branch', () => {
        const result = validateApiResponse('ApiKey', VALID_KEY);
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, ApiKey>>(true);
        }
    });

    it('checks the shared project listing against the ref component', () => {
        expect(validateApiResponse('ProjectRefArray', [VALID_PROJECT_REF]).valid).toBe(true);
        expect(validateApiResponse('ProjectRefArray', [{ ...VALID_PROJECT_REF, restricted: true }]).valid).toBe(true);
        expect(validateApiResponse('ProjectRefArray', [{ id: 'p1', name: 'Research' }]).valid).toBe(false);
    });

    it('checks the two single-field responses the key endpoints publish', () => {
        expect(validateApiResponse('AuthTokenResponse', { token: 'ey...' }).valid).toBe(true);
        expect(validateApiResponse('AuthTokenResponse', { token: 'ey...', refresh: 'x' }).valid).toBe(false);
        expect(validateApiResponse('DeleteOperationResult', { acknowledged: true, deletedCount: 1 }).valid).toBe(true);
        expect(validateApiResponse('DeleteOperationResult', { acknowledged: true }).valid).toBe(false);
    });
});
