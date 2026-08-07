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
 *
 * Generating a validator for each of the ~1000 components is real work: well under a second on a
 * developer machine, ~8s on a loaded CI runner, past vitest's 5s default, hence the explicit budget
 * below. It is generous on purpose — an unsupported discriminator makes AJV THROW during
 * compilation, so a genuine regression is caught by the try/catch and never by the clock.
 */
const COMPILE_ALL_TIMEOUT_MS = 60_000;

describe('published discriminators', () => {
    it(
        'compiles every registered component under AJV discriminator support',
        () => {
            const failures: string[] = [];
            for (const name of Object.keys(ApiSchemaComponents)) {
                try {
                    // Compilation is the subject; the value only has to reach the validator. An
                    // invalid result is expected and irrelevant.
                    validateApiResponse(name as ApiComponentName, undefined);
                } catch (err: unknown) {
                    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            expect(failures, `components AJV could not compile:\n${failures.join('\n')}`).toEqual([]);
        },
        COMPILE_ALL_TIMEOUT_MS,
    );

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

    it('does not merge undeclared names across the branches of an undiscriminated union', () => {
        // The process-runs list, which `ProcessDefinitionBody` reaches through
        // `ListAgentRunsResponse.items[].process_definition_snapshot`. `branches` is a `oneOf` with
        // no tag, so BOTH candidates report at the same path, and gathering by path alone produced
        //
        //     /nodes/x/branches/0 must NOT have additional properties: label, to, when
        //
        // `to` and `when` are declared on `BranchDefinition` — the shape this value plainly means.
        // Only `label` is undeclared anywhere, and the merged line sent the reader after two valid
        // fields.
        const legacyBranch = { label: 'Accepted', to: 'accepted', when: { '==': [{ var: 'ok' }, true] } };
        const result = validateApiResponse('ProcessDefinitionBody', {
            format_version: 1,
            process: 'demo',
            initial: 'accept_content',
            context: { schema: { type: 'object' }, initial: {} },
            nodes: { accept_content: { type: 'condition', branches: [legacyBranch] } },
        });
        expect(result.valid).toBe(false);
        if (result.valid) return;

        const undeclaredAt = (component: string): string[] | undefined =>
            result.issues.find(
                (i) =>
                    i.path === '/nodes/accept_content/branches/0' &&
                    i.component === component &&
                    i.undeclared !== undefined,
            )?.undeclared;

        // Against the branch it means, `label` is the whole story — `to` and `when` are declared.
        expect(undeclaredAt('BranchDefinition')).toEqual(['label']);

        // The other candidate is still reported, because with no tag neither can be ruled out; it is
        // named so it reads as a claim about that shape rather than about the value.
        expect(undeclaredAt('BranchNodeBranchDefinition')).toEqual(['label', 'to', 'when']);
    });

    it('leaves the component off when a path has only one candidate shape', () => {
        // The name earns its place only where it disambiguates. On an ordinary object it repeats
        // what the reader already knows and spends characters against the response budget.
        const result = validateApiResponse('ProcessDefinitionBody', {
            format_version: 1,
            process: 'demo',
            initial: 'a',
            title: 'Undeclared at the body level',
            context: { schema: { type: 'object' }, initial: {} },
            nodes: {},
        });
        expect(result.valid).toBe(false);
        if (result.valid) return;
        expect(result.issues).toEqual([
            { path: '/', message: 'must NOT have additional properties', undeclared: ['title'], component: undefined },
        ]);
        expect(result.errors).toEqual(['/ must NOT have additional properties: title']);
    });

    it('still gathers every undeclared name one schema reports at a path', () => {
        // The case gathering exists for, unaffected by the split above: one strict object, many
        // foreign keys — an unmapped Mongoose subdocument — stays a single issue.
        const result = validateApiResponse('ProcessDefinitionBody', {
            format_version: 1,
            process: 'demo',
            initial: 'a',
            context: { schema: { type: 'object' }, initial: {} },
            nodes: {},
            $__parent: {},
            $isNew: false,
            _doc: {},
        });
        expect(result.valid).toBe(false);
        if (result.valid) return;
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].undeclared).toEqual(['$__parent', '$isNew', '_doc']);
    });

    it('rejects a value whose tag names no branch', () => {
        const result = validateApiResponse('ToolCollectionObject', { type: 'nonesuch', url: 'https://example.com' });
        expect(result.valid).toBe(false);
        if (result.valid) return;
        expect(result.errors.join('; ')).toContain('tag');
    });
});
