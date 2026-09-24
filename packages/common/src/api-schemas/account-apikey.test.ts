import { describe, expect, it } from 'vitest';
import { ApiSchemaComponents } from '../api-contract/index.js';
import {
    AccountApiKeySchema,
    AccountApiKeyWithValueSchema,
    ApiKeySchema,
    CreateAccountApiKeyPayloadSchema,
    UpdateAccountApiKeyPayloadSchema,
} from './apikey.js';
import { validateApiRequest } from './registry.js';

describe('separate account-key wire contract', () => {
    const metadata = {
        id: 'key',
        name: 'IdP',
        account: 'account',
        scope: 'account',
        profile: 'account_admin_v1',
        enabled: true,
        maskedValue: 'sk-…',
        created_at: '2026-09-15T00:00:00Z',
        updated_at: '2026-09-15T00:00:00Z',
        created_by: 'user:admin',
        updated_by: 'user:admin',
    };
    it('requires account scope/profile without weakening the project-key contract', () => {
        expect(AccountApiKeySchema.safeParse(metadata).success).toBe(true);
        expect(AccountApiKeySchema.safeParse({ ...metadata, profile: 'other' }).success).toBe(false);
        expect(ApiKeySchema.safeParse(metadata).success).toBe(false);
        expect(AccountApiKeyWithValueSchema.safeParse(metadata).success).toBe(false);
        expect(AccountApiKeyWithValueSchema.safeParse({ ...metadata, value: 'test-secret' }).success).toBe(true);
    });
    it('publishes strict management payloads and metadata without a value or project property', () => {
        const components = ApiSchemaComponents as Record<
            string,
            { additionalProperties?: boolean; properties?: Record<string, unknown>; required?: string[] }
        >;
        for (const name of ['AccountApiKey', 'CreateAccountApiKeyPayload', 'UpdateAccountApiKeyPayload']) {
            expect(components[name].additionalProperties).toBe(false);
            expect(components[name].properties).not.toHaveProperty('value');
            expect(components[name].properties).not.toHaveProperty('project');
        }
        expect(components.ApiKey.required).toContain('project');
    });
});

// AJV enforces emitted JSON Schema; Zod trimming alone cannot reject whitespace at the API boundary.
describe.each([
    ['CreateAccountApiKeyPayload', CreateAccountApiKeyPayloadSchema],
    ['UpdateAccountApiKeyPayload', UpdateAccountApiKeyPayloadSchema],
] as const)('%s name validation', (component, schema) => {
    it.each(['', '   ', '\t\n ', '\u00a0'])('rejects blank name %j in Zod and AJV', (name) => {
        expect(schema.safeParse({ name }).success).toBe(false);
        expect(validateApiRequest(component, { name }).valid).toBe(false);
    });
    it.each(['IdP provisioning', '  IdP provisioning  '])('accepts nonblank name %j in both validators', (name) => {
        expect(schema.safeParse({ name }).success).toBe(true);
        expect(validateApiRequest(component, { name }).valid).toBe(true);
    });
});
