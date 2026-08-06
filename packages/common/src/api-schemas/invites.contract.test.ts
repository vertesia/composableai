import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { type ProjectRef, SystemRoles } from '../project.js';
import { TransientTokenType, type UserInviteToken, type UserInviteTokenData } from '../transient-tokens.js';
import type {
    AccountProjectsResponse,
    AccountRef,
    InviteAcceptanceResponse,
    InviteDeclineResponse,
    InviteUserRequestPayload,
    InviteUserResponsePayload,
    OnboardingProgress,
} from '../user.js';
import type { JsonObject } from './adapter.js';
import type { UserInviteTokenArrayFromSchema, UserInviteTokenFromSchema } from './invites.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest, validateApiResponse } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

function compile(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_INVITE = {
    id: '68b1779130afe5403a1589bc',
    type: TransientTokenType.userInvite,
    data: {
        email: 'grace@acme.test',
        role: SystemRoles.developer,
        account: { id: '68b1779130afe5403a1589ba', name: 'Acme' },
        invited_by: { id: '68b1779130afe5403a1589bd', name: 'Ada Lovelace', email: 'ada@acme.test' },
    },
    expires: '2030-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
};

/**
 * The component `TransientToken_UserInviteTokenData_Array` published before this batch, copied from
 * the generated document verbatim.
 *
 * This is the migration's first outright WRONG component rather than a merely incomplete one, and
 * the only way to keep checking a claim about a schema that no longer exists is to keep a copy of
 * it. The scanner met `TransientToken<UserInviteTokenData>[]` and dropped BOTH the generic argument
 * and the array: what it published describes a single object with none of the invite's content.
 */
const PREVIOUSLY_PUBLISHED_COMPONENT = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        expires: { type: 'string', format: 'date-time' },
        account: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'expires', 'created_at', 'updated_at'],
    additionalProperties: false,
} as const;

describe('gate 1 — the schema is the single source of truth for the public invite types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        assertType<Equals<UserInviteToken, UserInviteTokenFromSchema>>(true);
        assertType<Equals<UserInviteTokenArrayFromSchema, UserInviteToken[]>>(true);
        expect(true).toBe(true);
    });

    it('projects the account rather than restating it', () => {
        // `AccountRef` was the last hand-written twin in this closure, kept that way because
        // `ExecutionRun` and `UserInviteTokenData` reach it through types the scanner derives and
        // the scanner used to resolve a `z.infer<>` to nothing. It short-circuits such an alias to
        // the published component now, so the type is inferred and there is nothing to hold to the
        // schema — only the emission is still worth pinning.
        expect(ApiSchemaComponents.AccountRef).toEqual({
            type: 'object',
            properties: {
                id: (ApiSchemaComponents.Account.properties as Record<string, JsonObject>).id,
                name: (ApiSchemaComponents.Account.properties as Record<string, JsonObject>).name,
            },
            required: ['id', 'name'],
            additionalProperties: false,
        });
    });

    it('picks the invite request from the payload it writes', () => {
        const data = ApiSchemaComponents.UserInviteTokenData.properties as Record<string, JsonObject>;
        const request = ApiSchemaComponents.InviteUserRequestPayload.properties as Record<string, JsonObject>;
        expect(request).toEqual({ email: data.email, role: data.role });
        // The three the server owns are what the pick leaves out, and naming them here is what makes
        // adding a fourth writable field a decision rather than an accident.
        expect(Object.keys(request)).not.toContain('account');
        expect(Object.keys(request)).not.toContain('project');
        expect(Object.keys(request)).not.toContain('invited_by');
    });

    it('types the invite timestamps as strings, and expires as required', () => {
        // The generic `TransientToken<T>` still says `Date` — it describes the stored document, and
        // `ITransientToken` in studio-server extends it. `UserInviteToken` is the wire shape, where
        // the three are ISO strings; `toUserInviteTokenResponse` is what converts between them.
        assertType<Equals<UserInviteToken['expires'], string>>(true);
        assertType<Equals<UserInviteToken['created_at'], string>>(true);
        assertType<Equals<UserInviteToken['account'], string | undefined>>(true);
        expect(true).toBe(true);
    });

    it('types every reference as the populated object it is', () => {
        // All three listings `.populate()` these before responding. Nothing in the old type said so
        // — `TransientToken<UserInviteTokenData>` was reached through a cast — so an unpopulated
        // query would have shipped bare ObjectIds under a component promising objects.
        assertType<Equals<UserInviteTokenData['account'], AccountRef>>(true);
        assertType<Equals<UserInviteTokenData['invited_by']['email'], string>>(true);
        // `project` is the one optional reference: an account-wide invite has none.
        assertType<Equals<UserInviteTokenData['project'], ProjectRef | undefined>>(true);
        expect(true).toBe(true);
    });
});

describe('gate 2 — the published components match the closure the types come from', () => {
    it('finally declares the invite payload the endpoints have always sent', () => {
        const props = ApiSchemaComponents.TransientToken_UserInviteTokenData_.properties as Record<string, JsonObject>;
        expect(props.type).toEqual({ $ref: '#/components/schemas/TransientTokenType' });
        expect(props.data).toEqual({ $ref: '#/components/schemas/UserInviteTokenData' });
        expect(Object.keys(props)).not.toContain('uid');
    });

    it('publishes the listing as an array, which the endpoints have always returned', () => {
        expect(ApiSchemaComponents.TransientToken_UserInviteTokenData_Array).toEqual({
            type: 'array',
            items: { $ref: '#/components/schemas/TransientToken_UserInviteTokenData_' },
        });
        // What it replaced.
        expect(PREVIOUSLY_PUBLISHED_COMPONENT.type).toBe('object');
    });

    it('keeps AccountRef, ProjectRef and UserRef as the shared components they already were', () => {
        const props = ApiSchemaComponents.UserInviteTokenData.properties as Record<string, JsonObject>;
        expect(props.account).toEqual({ $ref: '#/components/schemas/AccountRef' });
        expect(props.project).toEqual({ $ref: '#/components/schemas/ProjectRef' });
        expect(props.invited_by).toEqual({ $ref: '#/components/schemas/UserRef' });
        expect(props.role).toEqual({ $ref: '#/components/schemas/SystemRoles' });
    });

    it('closes both invite components', () => {
        expect(ApiSchemaComponents.TransientToken_UserInviteTokenData_.additionalProperties).toBe(false);
        expect(ApiSchemaComponents.UserInviteTokenData.additionalProperties).toBe(false);
        expect(ApiSchemaComponents.UserInviteTokenData.required).toEqual(['email', 'role', 'account', 'invited_by']);
    });
});

describe('gate 3 — AJV validates the same canonical objects that are published', () => {
    it('accepts a minimal invite and rejects a missing required field', () => {
        const validate = compile('TransientToken_UserInviteTokenData_');
        expect(validate(VALID_INVITE)).toBe(true);
        const { data: _dropped, ...incomplete } = VALID_INVITE;
        expect(validate(incomplete)).toBe(false);
    });

    it('requires expires, which the Mongoose schema leaves optional', () => {
        const { expires: _dropped, ...withoutExpiry } = VALID_INVITE;
        expect(compile('TransientToken_UserInviteTokenData_')(withoutExpiry)).toBe(false);
    });

    it('rejects an ObjectId string where a populated reference is declared', () => {
        // The exact failure the mapper exists to prevent: a listing added without `.populate()`.
        const validate = compile('TransientToken_UserInviteTokenData_');
        const unpopulated = { ...VALID_INVITE, data: { ...VALID_INVITE.data, account: '68b1779130afe5403a1589ba' } };
        expect(validate(unpopulated)).toBe(false);
    });

    it('rejects uid, the external-identity match key that is not part of the payload', () => {
        const validate = compile('TransientToken_UserInviteTokenData_');
        expect(validate({ ...VALID_INVITE, data: { ...VALID_INVITE.data, uid: 'firebase-uid' } })).toBe(false);
    });

    it('rejects the internal fields a serialized document would have leaked', () => {
        const validate = compile('TransientToken_UserInviteTokenData_');
        expect(validate({ ...VALID_INVITE, _id: 'deadbeef' })).toBe(false);
        expect(validate({ ...VALID_INVITE, __v: 0 })).toBe(false);
    });

    it('constrains the token type and the invited role to their catalogs', () => {
        const validate = compile('TransientToken_UserInviteTokenData_');
        expect(validate({ ...VALID_INVITE, type: 'password-reset' })).toBe(false);
        expect(validate({ ...VALID_INVITE, type: TransientTokenType.migration })).toBe(true);
        expect(validate({ ...VALID_INVITE, data: { ...VALID_INVITE.data, role: 'superuser' } })).toBe(false);
    });

    it('validates the invite request and the three fixed-shape responses', () => {
        expect(compile('InviteUserRequestPayload')({ email: 'g@acme.test', role: SystemRoles.reader })).toBe(true);
        expect(compile('InviteUserRequestPayload')({ email: 'g@acme.test' })).toBe(false);
        expect(compile('InviteUserResponsePayload')({ action: 'invited' })).toBe(true);
        expect(compile('InviteUserResponsePayload')({ action: 'ignored' })).toBe(false);
        expect(compile('InviteAcceptanceResponse')({ status: 'added' })).toBe(true);
        expect(compile('InviteDeclineResponse')({ status: 'deleted' })).toBe(true);
        expect(compile('InviteDeclineResponse')({ status: 'added' })).toBe(false);
    });

    it('requires all four onboarding flags rather than treating absence as false', () => {
        const validate = compile('OnboardingProgress');
        const progress = {
            interactions: true,
            prompts: false,
            environments: true,
            default_environment_defined: false,
        };
        expect(validate(progress)).toBe(true);
        const { prompts: _dropped, ...partial } = progress;
        expect(validate(partial)).toBe(false);
    });
});

describe('gate 4 — runtime enforcement uses the published components', () => {
    it('checks every member of a listing against the same invite component', () => {
        expect(validateApiResponse('TransientToken_UserInviteTokenData_Array', [VALID_INVITE]).valid).toBe(true);
        expect(validateApiResponse('TransientToken_UserInviteTokenData_Array', []).valid).toBe(true);
        const unpopulated = { ...VALID_INVITE, data: { ...VALID_INVITE.data, invited_by: 'ada' } };
        expect(validateApiResponse('TransientToken_UserInviteTokenData_Array', [VALID_INVITE, unpopulated]).valid).toBe(
            false,
        );
        // A bare object rather than an array — what the old component described and no endpoint sent.
        expect(validateApiResponse('TransientToken_UserInviteTokenData_Array', VALID_INVITE).valid).toBe(false);
    });

    it('rejects an undeclared invite request field without removing it', () => {
        const payload: Record<string, unknown> = { email: 'g@acme.test', role: SystemRoles.reader, rogue_field: 42 };
        const result = validateApiRequest('InviteUserRequestPayload', payload);
        expect(result.valid).toBe(false);
        expect(payload.rogue_field).toBe(42);
    });

    it('hands back the component type on the valid branch', () => {
        const result = validateApiResponse('TransientToken_UserInviteTokenData_Array', [VALID_INVITE]);
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, UserInviteToken[]>>(true);
        }
    });

    it('checks the account project listing envelope', () => {
        const ref = { id: '69d4762f24d3048c99149d0b', name: 'Research', account: '68b1779130afe5403a1589ba' };
        expect(validateApiResponse('AccountProjectsResponse', { data: [ref] }).valid).toBe(true);
        expect(validateApiResponse('AccountProjectsResponse', { data: [] }).valid).toBe(true);
        // An envelope, not a bare array — which is what the document already published.
        expect(validateApiResponse('AccountProjectsResponse', [ref]).valid).toBe(false);
        assertType<Equals<AccountProjectsResponse['data'], ProjectRef[]>>(true);
    });

    it('enforces the date-time format through the registry validator', () => {
        // The local `compile()` deliberately omits ajv-formats, so a malformed timestamp has to be
        // checked here or the assertion passes vacuously.
        expect(
            validateApiResponse('TransientToken_UserInviteTokenData_Array', [{ ...VALID_INVITE, expires: 'next year' }])
                .valid,
        ).toBe(false);
    });

    it('keeps the fixed-shape responses typed as their literals', () => {
        assertType<Equals<InviteAcceptanceResponse['status'], 'added'>>(true);
        assertType<Equals<InviteDeclineResponse['status'], 'deleted'>>(true);
        assertType<Equals<InviteUserResponsePayload['action'], 'invited' | 'added'>>(true);
        assertType<Equals<InviteUserRequestPayload['email'], string>>(true);
        assertType<Equals<OnboardingProgress['prompts'], boolean>>(true);
        expect(true).toBe(true);
    });
});
