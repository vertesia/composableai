import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { CreateUserGroupPayload, UpdateUserGroupPayload, UserGroup } from '../group.js';
import type { User, UserRef } from '../user.js';
import type { JsonObject } from './adapter.js';
import type {
    CreateUserGroupPayloadFromSchema,
    UpdateUserGroupPayloadFromSchema,
    UserGroupArrayFromSchema,
    UserGroupFromSchema,
} from './group.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest, validateApiResponse } from './registry.js';
import type { UserRefArrayFromSchema, UserRefFromSchema } from './user.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

function compile(name: string, components: Readonly<Record<string, JsonObject>> = ApiSchemaComponents) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: components } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_GROUP = {
    id: 'g1',
    account: 'a1',
    name: 'Engineering',
    tags: ['eng'],
    created_at: '2026-07-30T10:00:00.000Z',
    updated_at: '2026-07-30T10:00:00.000Z',
};

const VALID_REF = { id: 'u1', name: 'Someone', email: 'someone@acme.com' };

describe('gate 1 — the schema is the single source of truth for the public group types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        assertType<Equals<UserGroup, UserGroupFromSchema>>(true);
        assertType<Equals<UserGroupArrayFromSchema, UserGroup[]>>(true);
        assertType<Equals<CreateUserGroupPayload, CreateUserGroupPayloadFromSchema>>(true);
        assertType<Equals<UpdateUserGroupPayload, UpdateUserGroupPayloadFromSchema>>(true);
        assertType<Equals<UserRef, UserRefFromSchema>>(true);
        assertType<Equals<UserRefArrayFromSchema, UserRef[]>>(true);
        expect(true).toBe(true);
    });

    it('types the timestamps as the strings a client actually receives', () => {
        // They were `Date` on the public type while the document published `format: date-time`
        // strings. JSON has no date type, so the old declaration described the Mongoose document
        // rather than the response — this is the correction, and the reason it is a compile-time
        // break for anyone who was calling `.getTime()` on one.
        assertType<Equals<UserGroup['created_at'], string>>(true);
        assertType<Equals<UserGroup['updated_at'], string>>(true);
        assertType<Equals<UserGroup['tags'], string[]>>(true);
        assertType<Equals<UserGroup['allowed_projects'], string[] | undefined>>(true);
        expect(true).toBe(true);
    });

    it('derives UserRef from User rather than restating four fields', () => {
        // `.pick()` on UserSchema, so a change to how `User` declares one of these follows through
        // instead of leaving a twin behind. The requiredness comes with it: `email` is required on
        // both, which is why the members listing has to map rather than serialize.
        assertType<Equals<UserRef['id'], User['id']>>(true);
        assertType<Equals<UserRef['name'], User['name']>>(true);
        assertType<Equals<UserRef['email'], User['email']>>(true);
        assertType<Equals<UserRef['picture'], User['picture']>>(true);
        // And nothing else came across.
        assertType<Equals<keyof UserRef, 'id' | 'name' | 'email' | 'picture'>>(true);
        expect(true).toBe(true);
    });

    it('derives both payloads from the group rather than restating its fields', () => {
        // Same reasoning as UserRef, applied to the write side: each payload is a subset of the
        // group, so the field types follow the response. Only requiredness differs, and only where
        // it should — `tags` is required on a group the server always populates and optional in a
        // payload the caller need not send.
        assertType<Equals<CreateUserGroupPayload['name'], UserGroup['name']>>(true);
        assertType<Equals<CreateUserGroupPayload['description'], UserGroup['description']>>(true);
        assertType<Equals<CreateUserGroupPayload['tags'], string[] | undefined>>(true);
        assertType<Equals<keyof CreateUserGroupPayload, 'name' | 'description' | 'tags' | 'allowed_projects'>>(true);
        assertType<Equals<UpdateUserGroupPayload['properties'], UserGroup['properties']>>(true);
        assertType<Equals<UpdateUserGroupPayload['clearance'], UserGroup['clearance']>>(true);
        assertType<Equals<UpdateUserGroupPayload['compartments'], UserGroup['compartments']>>(true);
        // The whitelist is what the pick leaves out: nothing server-owned is writable.
        assertType<
            Equals<
                keyof UpdateUserGroupPayload,
                'name' | 'description' | 'tags' | 'properties' | 'clearance' | 'compartments' | 'allowed_projects'
            >
        >(true);
        expect(true).toBe(true);
    });
});

describe('gate 2 — the published components match the closure the types come from', () => {
    it('does not declare members on the group component', () => {
        // Three handlers were shipping `members` — two by populating a `select: false` path, one by
        // returning the in-memory document — while the component is closed and has never declared
        // it. Members are published by their own route as UserRef[].
        expect(Object.keys(ApiSchemaComponents.UserGroup.properties as JsonObject)).not.toContain('members');
        expect(ApiSchemaComponents.UserGroup.additionalProperties).toBe(false);
    });

    it('publishes UserRef as its own component, not a $ref back to User', () => {
        // `.pick()` drops the `id: 'User'` metadata, which is what keeps the projection a separate
        // component. If it carried the id across, every UserRef slot would suddenly promise a whole
        // User to generated clients.
        expect(JSON.stringify(ApiSchemaComponents.UserRef)).not.toContain('$ref');
        expect(ApiSchemaComponents.UserRef.required).toEqual(['id', 'name', 'email']);
        expect(ApiSchemaComponents.UserRefArray).toEqual({
            type: 'array',
            items: { $ref: '#/components/schemas/UserRef' },
        });
    });

    it('keeps the timestamps enforceable rather than merely documented', () => {
        const props = ApiSchemaComponents.UserGroup.properties as Record<string, JsonObject>;
        expect(props.created_at).toEqual({ type: 'string', format: 'date-time' });
        expect(ApiSchemaComponents.UserGroup.required).toEqual([
            'id',
            'account',
            'name',
            'tags',
            'created_at',
            'updated_at',
        ]);
    });
});

describe('gate 3 — AJV validates the same canonical objects that are published', () => {
    it('accepts a minimal group and rejects a missing required field', () => {
        const validate = compile('UserGroup');
        expect(validate(VALID_GROUP)).toBe(true);
        const { tags: _dropped, ...incomplete } = VALID_GROUP;
        expect(validate(incomplete)).toBe(false);
    });

    it('rejects the internal fields a serialized document would have leaked', () => {
        const validate = compile('UserGroup');
        expect(validate({ ...VALID_GROUP, members: ['u1'] })).toBe(false);
        expect(validate({ ...VALID_GROUP, _id: 'deadbeef' })).toBe(false);
        expect(validate({ ...VALID_GROUP, __v: 0 })).toBe(false);
    });

    it('requires a name on the update payload, which both handlers checked by hand', () => {
        const validate = compile('UpdateUserGroupPayload');
        expect(validate({ name: 'Renamed' })).toBe(true);
        expect(validate({})).toBe(false);
        expect(validate({ name: 'Renamed', rogue_field: 1 })).toBe(false);
    });

    it('accepts a create payload with only a name', () => {
        const validate = compile('CreateUserGroupPayload');
        expect(validate({ name: 'Engineering' })).toBe(true);
        expect(validate({ name: 'Engineering', allowed_projects: [] })).toBe(true);
        // `properties` and `clearance` are updatable but not settable at creation, and never were.
        expect(validate({ name: 'Engineering', clearance: 3 })).toBe(false);
    });

    it('documents allowed_projects for the request rather than inheriting the response text', () => {
        // The one field where picking is not enough: the response explains what an empty list MEANS,
        // the request explains what sending one DOES. Overriding the picked field is how a payload
        // keeps request-specific documentation — and the same mechanism a field with genuinely
        // different request semantics would need.
        const create = (ApiSchemaComponents.CreateUserGroupPayload.properties as Record<string, JsonObject>)
            .allowed_projects;
        const group = (ApiSchemaComponents.UserGroup.properties as Record<string, JsonObject>).allowed_projects;
        expect(create.description).toBe('Restrict the new group to the given projects (empty/absent = org-wide).');
        expect(create.description).not.toBe(group.description);
        // Everything except the description still comes from the group.
        expect({ ...create, description: undefined }).toEqual({ ...group, description: undefined });
    });
});

describe('gate 4 — runtime enforcement uses the published components', () => {
    it('enforces the date-time format the timestamps claim', () => {
        // Through the registry rather than the local `compile` helper: the production validator
        // registers ajv-formats, and a bare Ajv2020 ignores `format` entirely.
        expect(validateApiResponse('UserGroup', { ...VALID_GROUP, created_at: 'yesterday' }).valid).toBe(false);
        expect(validateApiResponse('UserGroup', VALID_GROUP).valid).toBe(true);
    });

    it('rejects an undeclared update field without removing it', () => {
        const payload: Record<string, unknown> = { name: 'Acme', rogue_field: 42 };
        const result = validateApiRequest('UpdateUserGroupPayload', payload);
        expect(result.valid).toBe(false);
        expect(payload.rogue_field).toBe(42);
    });

    it('checks every member of the group listing against the same UserGroup component', () => {
        expect(validateApiResponse('UserGroupArray', [VALID_GROUP, VALID_GROUP]).valid).toBe(true);
        expect(validateApiResponse('UserGroupArray', []).valid).toBe(true);
        // One group still carrying its members is what the unmapped listing would have produced.
        expect(validateApiResponse('UserGroupArray', [VALID_GROUP, { ...VALID_GROUP, members: [] }]).valid).toBe(false);
    });

    it('checks every member of the members listing against UserRef', () => {
        expect(validateApiResponse('UserRefArray', [VALID_REF]).valid).toBe(true);
        // A user Mongo holds with no email — required on the wire, which is why the handler maps.
        const { email: _dropped, ...withoutEmail } = VALID_REF;
        expect(validateApiResponse('UserRefArray', [withoutEmail]).valid).toBe(false);
        expect(validateApiResponse('UserRefArray', [{ ...VALID_REF, email: '' }]).valid).toBe(true);
        // And the whole user document, which is what serializing the populated doc would send.
        expect(validateApiResponse('UserRefArray', [{ ...VALID_REF, clearance: 3 }]).valid).toBe(false);
    });

    it('hands back the component type on the valid branch', () => {
        const result = validateApiResponse('UserGroup', VALID_GROUP);
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, UserGroup>>(true);
        }
    });
});
