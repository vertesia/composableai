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

    /** A one-branch `condition` node, the smallest thing that reaches the untagged `branches` union. */
    function withBranch(branch: unknown): unknown {
        return {
            format_version: 1,
            process: 'demo',
            initial: 'a',
            context: { schema: { type: 'object' }, initial: {} },
            nodes: { a: { type: 'condition', branches: [branch] } },
        };
    }

    it('attributes every claim under an untagged union to the candidate that made it', () => {
        // The process-runs list, which `ProcessDefinitionBody` reaches through
        // `ListAgentRunsResponse.items[].process_definition_snapshot`. `branches` is a `oneOf` with
        // no tag, so AJV reports every candidate's failures flat and unattributed:
        //
        //     /nodes/a/branches/0 must NOT have additional properties: label, to, when
        //
        // `to` and `when` are declared on `BranchDefinition` — the shape this value plainly means —
        // so read as a fact that line sends the reader after two valid fields.
        const result = validateApiResponse(
            'ProcessDefinitionBody',
            withBranch({ label: 'Accepted', to: 'accepted', when: { '==': [{ var: 'ok' }, true] } }),
        );
        expect(result.valid).toBe(false);
        if (result.valid) return;

        // Against the candidate it means, `label` is the whole story.
        expect(result.errors).toContain(
            '/nodes/a/branches/0 as BranchDefinition: must NOT have additional properties: label',
        );
        // The other candidate is still reported — with no tag neither can be ruled out — but named,
        // so it reads as a claim about that shape rather than about the value.
        expect(result.errors).toContain(
            '/nodes/a/branches/0 as BranchNodeBranchDefinition: must NOT have additional properties: label, to, when',
        );
        // Every attributed claim names a candidate of THIS union, never some nearer schema.
        const named = result.issues.filter((i) => i.component !== undefined).map((i) => i.component);
        expect(new Set(named)).toEqual(new Set(['BranchDefinition', 'BranchNodeBranchDefinition']));
    });

    it('attributes candidates that fail at different paths', () => {
        // The case that defeats counting candidates per instance path: with a malformed `when`, the
        // intended candidate fails at `/when` while the other fails at the branch root, so no path
        // has two candidates and a per-path rule drops EVERY name — leaving
        //
        //     /nodes/a/branches/0 must NOT have additional properties: to, when
        //
        // stated as a bare fact again. Attribution has to follow the union, not the path.
        const result = validateApiResponse('ProcessDefinitionBody', withBranch({ to: 'accepted', when: 'bad' }));
        expect(result.valid).toBe(false);
        if (result.valid) return;

        expect(result.errors).toContain('/nodes/a/branches/0/when as BranchDefinition: must be object');
        expect(result.errors).toContain(
            '/nodes/a/branches/0 as BranchNodeBranchDefinition: must NOT have additional properties: to, when',
        );
        // The point of the fix: nothing under a failed union is left unattributed except the union's
        // own line, so no candidate's complaint can be mistaken for a fact about the value.
        const unattributed = result.issues.filter((i) => i.component === undefined);
        expect(unattributed.map((i) => i.message)).toEqual(['must match exactly one schema in oneOf']);
    });

    it('leaves the component off outside a union', () => {
        // A component name marks a claim as conditional. Attaching one where the issue holds
        // outright would weaken a fact, besides spending characters against the response budget.
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
