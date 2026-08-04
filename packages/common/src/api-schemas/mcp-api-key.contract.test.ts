import { describe, expect, it } from 'vitest';
import type { McpApiKeyStatus } from '../apps.js';
import { AppInstallationPayloadSchema } from './app-lifecycle.js';
import { McpApiKeyStatusSchema, SetMcpApiKeyRequestSchema } from './apps.js';
import { validateApiRequest } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

/**
 * Request bodies are enforced by AJV against the EMITTED JSON Schema, not by parsing with Zod. A
 * Zod-only assertion would pass on transforms (`.trim()`) that leave no trace in the emission and
 * therefore never run at the endpoint — so the blank-key cases below go through `validateApiRequest`,
 * which is the path `validatedBody` actually takes.
 */
describe('SetMcpApiKeyRequest — as enforced at the endpoint (AJV)', () => {
    it('accepts a real key', () => {
        expect(validateApiRequest('SetMcpApiKeyRequest', { api_key: 'sk-live-abcdef' }).valid).toBe(true);
    });

    it('rejects a whitespace-only key', () => {
        expect(validateApiRequest('SetMcpApiKeyRequest', { api_key: '   ' }).valid).toBe(false);
    });

    it('rejects a tab/newline-only key', () => {
        expect(validateApiRequest('SetMcpApiKeyRequest', { api_key: '\t\n ' }).valid).toBe(false);
    });

    it('rejects an empty key', () => {
        expect(validateApiRequest('SetMcpApiKeyRequest', { api_key: '' }).valid).toBe(false);
    });

    it('rejects a missing key', () => {
        expect(validateApiRequest('SetMcpApiKeyRequest', {}).valid).toBe(false);
    });

    it('rejects unknown properties', () => {
        expect(validateApiRequest('SetMcpApiKeyRequest', { api_key: 'sk-live', collection_id: 'x' }).valid).toBe(false);
    });

    it('still normalizes surrounding whitespace for Zod consumers', () => {
        expect(SetMcpApiKeyRequestSchema.parse({ api_key: '  sk-live-abcdef  ' }).api_key).toBe('sk-live-abcdef');
    });
});

describe('AppInstallationPayload.api_key_params — as enforced at the endpoint (AJV)', () => {
    const APP_ID = '68b1779130afe5403a1589bc';

    it('accepts a key per collection', () => {
        const result = validateApiRequest('AppInstallationPayload', {
            app_id: APP_ID,
            api_key_params: { acme_mcp: { api_key: 'sk-install-abcdef' } },
        });
        expect(result.valid).toBe(true);
    });

    it('rejects a whitespace-only key on the install path too', () => {
        const result = validateApiRequest('AppInstallationPayload', {
            app_id: APP_ID,
            api_key_params: { acme_mcp: { api_key: '  ' } },
        });
        expect(result.valid).toBe(false);
    });

    it('stays optional — installs with no api_key collections send nothing', () => {
        expect(validateApiRequest('AppInstallationPayload', { app_id: APP_ID }).valid).toBe(true);
        expect(AppInstallationPayloadSchema.parse({ app_id: APP_ID }).api_key_params).toBeUndefined();
    });
});

describe('McpApiKeyStatus', () => {
    it('publishes hint as required-but-nullable, not optional', () => {
        // Every response sets `hint`, so the field must not be optional in the generated clients.
        assertType<Equals<McpApiKeyStatus, { configured: boolean; hint: string | null }>>(true);
        expect(McpApiKeyStatusSchema.safeParse({ configured: false }).success).toBe(false);
        expect(McpApiKeyStatusSchema.safeParse({ configured: false, hint: null }).success).toBe(true);
        expect(McpApiKeyStatusSchema.safeParse({ configured: true, hint: 'sk-l...3456' }).success).toBe(true);
    });

    it('never carries the key itself', () => {
        expect(McpApiKeyStatusSchema.safeParse({ configured: true, hint: null, api_key: 'sk-live' }).success).toBe(
            false,
        );
    });
});
