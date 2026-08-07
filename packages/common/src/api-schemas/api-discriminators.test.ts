import { describe, expect, it } from 'vitest';
import { type ApiComponentName, ApiSchemaComponents, validateApiResponse } from './registry.js';

/**
 * The build-time half of `discriminator: true`.
 *
 * AJV applies its discriminator rules when it COMPILES a schema, not when it validates one, and it
 * signals a union it cannot handle by throwing. Left unchecked that turns into a 500 on the first
 * request to whichever endpoint publishes the offending component — a failure mode that depends on
 * traffic and would reach a deployed environment before anyone saw it. Compiling every registered
 * component here moves that to the build, and names the component when it happens.
 *
 * The rules a union has to satisfy, all of which `synthesizeDiscriminator` in the adapter already
 * enforces before emitting a discriminator: `oneOf` members resolving to object schemas, a tag
 * property present and REQUIRED in every branch, and a `const` or single-valued `enum` for the tag
 * in each. A hand-written `.meta({ discriminator })` gets no such check when it is written, which
 * is the case this test exists for.
 */
describe('published discriminators', () => {
    it('compiles every registered component under AJV discriminator support', () => {
        const failures: string[] = [];
        for (const name of Object.keys(ApiSchemaComponents)) {
            try {
                // Compilation is the subject; the value only has to reach the validator. An invalid
                // result is expected and irrelevant.
                validateApiResponse(name as ApiComponentName, undefined);
            } catch (err: unknown) {
                failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        expect(failures, `components AJV could not compile:\n${failures.join('\n')}`).toEqual([]);
    });

    it('keeps discriminator mapping in the published components for generated clients', () => {
        // AJV's copy drops `mapping`; the OpenAPI document must not. A Java or Go client reads the
        // mapping to pick a concrete subtype, so losing it here would be a silent codegen
        // regression that no schema assertion elsewhere would catch.
        const union = ApiSchemaComponents.ToolCollectionObject as {
            discriminator?: { propertyName?: string; mapping?: Record<string, string> };
        };
        expect(union.discriminator?.propertyName).toBe('type');
        expect(union.discriminator?.mapping).toMatchObject({
            mcp: '#/components/schemas/MCPToolCollectionObject',
        });
    });

    it('reports only the tagged branch when a legacy MCP collection is missing its id', () => {
        // The `hubspot-mcp-dev` shape: created before the write path required `id`, still served by
        // the five-level resolution chain in fetch-tools.ts. Without discriminator support AJV also
        // reported `oauth_app` as an undeclared property and `type` as not matching a constant —
        // both from the vertesia_sdk branch this value never claimed to be.
        const legacy = {
            type: 'mcp',
            name: 'HubSpot',
            namespace: 'hubspot',
            description: 'HubSpot MCP',
            auth: 'oauth',
            url: 'https://mcp.hubspot.com',
            oauth_app: 'hubspot',
        };
        const result = validateApiResponse('ToolCollectionObject', legacy);
        expect(result.valid).toBe(false);
        if (result.valid) return;
        expect(result.errors).toEqual(["/ must have required property 'id'"]);
    });

    it('rejects a value whose tag names no branch', () => {
        const result = validateApiResponse('ToolCollectionObject', { type: 'nonesuch', url: 'https://example.com' });
        expect(result.valid).toBe(false);
        if (result.valid) return;
        expect(result.errors.join('; ')).toContain('tag');
    });
});
