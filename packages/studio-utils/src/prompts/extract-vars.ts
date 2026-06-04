import Handlebars from 'handlebars';

/**
 * Extract the set of root-level variable names referenced by a Handlebars template.
 *
 * - `{{foo}}` → `foo`
 * - `{{obj.bar.baz}}` → `obj` (only the root identifier; nested access doesn't add `bar` or `baz`)
 * - `{{#if cond}}{{name}}{{/if}}` → `cond`, `name`
 * - `{{#each items as |item|}}{{item.name}}{{/each}}` → `items` (NOT `item` — bound by `as |item|`)
 * - `{{lookup obj key}}` → `obj`, `key` (helper name skipped)
 * - `{{@index}}`, `{{this}}` → ignored (built-in data vars / self)
 *
 * Helper names in mustaches and block heads (`{{customHelper x}}`, `{{#if x}}`) are NOT added to
 * the set — only the arguments and inner template references are. This matches the typical use
 * case for prompt validation: detect which schema properties the template actually reads.
 *
 * Returns an empty set on parse failure — callers should also run a syntactic render check
 * (e.g. `executeHandlebars`) to surface parse errors separately.
 */
export function extractHandlebarsVariables(template: string): Set<string> {
    let ast: hbs.AST.Program;
    try {
        ast = Handlebars.parse(template);
    } catch {
        return new Set();
    }

    const variables = new Set<string>();
    const localScopes: Array<Set<string>> = [];

    const isLocal = (name: string): boolean => localScopes.some((scope) => scope.has(name));

    const visit = (node: unknown): void => {
        if (!node || typeof node !== 'object') return;
        const n = node as { type: string } & Record<string, unknown>;

        switch (n.type) {
            case 'Program': {
                const body = n.body as unknown[] | undefined;
                if (body) for (const stmt of body) visit(stmt);
                break;
            }

            case 'BlockStatement': {
                // n.path is the helper name (`#if`, `#each`, `#customBlock`) — never a variable.
                // Visit params + hash to capture variables passed to the block helper.
                const params = n.params as unknown[] | undefined;
                if (params) for (const p of params) visit(p);
                visit(n.hash);

                // Track `as |x y|` block params — these are local bindings, not variables.
                const program = n.program as { blockParams?: string[] } | undefined;
                const inverse = n.inverse as { blockParams?: string[] } | undefined;
                const scope = new Set<string>([...(program?.blockParams ?? []), ...(inverse?.blockParams ?? [])]);
                localScopes.push(scope);

                visit(n.program);
                visit(n.inverse);

                localScopes.pop();
                break;
            }

            case 'MustacheStatement': {
                // Bare mustache (no params, no hash) → it's a variable reference.
                // With params/hash, it's a helper call — skip the path (helper name), visit args.
                const params = n.params as unknown[] | undefined;
                const hash = n.hash as { pairs?: unknown[] } | undefined;
                const isHelperCall = (params?.length ?? 0) > 0 || (hash?.pairs?.length ?? 0) > 0;
                if (!isHelperCall) {
                    visit(n.path);
                }
                if (params) for (const p of params) visit(p);
                visit(hash);
                break;
            }

            case 'SubExpression': {
                // (helper arg1 arg2) — helper name in path is skipped, args carry variables.
                const params = n.params as unknown[] | undefined;
                if (params) for (const p of params) visit(p);
                visit(n.hash);
                break;
            }

            case 'PathExpression': {
                if (n.data) break; // `@-data` references (@index, @key, etc.)
                const parts = n.parts as string[] | undefined;
                if (!parts || parts.length === 0) break; // `this` / `.`
                const root = parts[0];
                if (isLocal(root)) break;
                variables.add(root);
                break;
            }

            case 'Hash': {
                const pairs = n.pairs as Array<{ value: unknown }> | undefined;
                if (pairs) for (const pair of pairs) visit(pair.value);
                break;
            }

            // ContentStatement, CommentStatement, *Literal, PartialStatement — no variables to extract.
            default:
                break;
        }
    };

    visit(ast);
    return variables;
}
