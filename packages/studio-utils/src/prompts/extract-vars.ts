import { HANDLEBARS_CONTEXT_HELPERS, isHandlebarsHelper, isTemplateSystemVariable } from '@vertesia/jst';
import Handlebars from 'handlebars';

/** A read of a root-level template variable. */
export interface HandlebarsVariableReference {
    /** Root identifier: `customer` for `{{customer.name}}`, `{{../customer}}` or `{{@root.customer}}`. */
    name: string;
    /** The path as written, e.g. `customer.name`. */
    expression: string;
    /** True when the path reads a property of the variable (`customer.name`). */
    hasPath: boolean;
    /** Source of the tag that contains the read, e.g. `{{#if customer}}`. */
    tag: string;
}

/** A helper name used where Handlebars will not call it. */
export interface HandlebarsHelperMisuse {
    helper: string;
    /**
     * - `used_as_value`: passed as an argument (`{{#if stringify}}`), where Handlebars reads the data.
     * - `missing_arguments`: called bare (`{{stringify}}`) with none of the arguments it needs.
     */
    problem: 'used_as_value' | 'missing_arguments';
    tag: string;
}

export interface HandlebarsTemplateAnalysis {
    references: HandlebarsVariableReference[];
    helperMisuses: HandlebarsHelperMisuse[];
}

interface PathNode {
    type: 'PathExpression';
    original: string;
    parts: string[];
    depth: number;
    data: boolean;
}

interface SourceLocation {
    start: { line: number; column: number };
}

type Node = { type: string; loc?: SourceLocation } & Record<string, unknown>;

/** Context a template section renders with: the input root, or an item whose shape is unknown. */
type ContextKind = 'root' | 'item';

function isPath(node: unknown): node is PathNode {
    return !!node && typeof node === 'object' && (node as Node).type === 'PathExpression';
}

/** `this.x`, `./x` and `this` read the context explicitly — Handlebars never treats them as helpers. */
function isScoped(path: PathNode): boolean {
    return /^\.|this\b/.test(path.original);
}

/** A single bare identifier — the only form Handlebars may resolve to a helper. */
function isSimpleId(path: PathNode): boolean {
    return path.parts.length === 1 && !isScoped(path) && !path.data && path.depth === 0;
}

function lineOffsets(template: string): number[] {
    const offsets = [0];
    for (let i = 0; i < template.length; i++) {
        if (template[i] === '\n') offsets.push(i + 1);
    }
    return offsets;
}

/**
 * Analyze the variables and helpers a Handlebars template uses, resolving names the way the
 * prompt renderer does (helpers and system variables come from `@vertesia/jst`).
 *
 * Scoping rules:
 * - Inside `{{#each}}` / `{{#with}}` (and `{{#section}}` over data), bare names read the current item,
 *   whose shape the input schema does not describe — they are not reported. `../x` and `@root.x`
 *   read the enclosing or root context and are reported.
 * - `as |x|` block params are local bindings, not variables.
 * - `{{@index}}` and other `@`-data (except `@root.x`) are runtime values, not variables.
 *
 * Returns null when the template does not parse; the render check reports the syntax error.
 */
export function analyzeHandlebarsTemplate(template: string): HandlebarsTemplateAnalysis | null {
    let ast: hbs.AST.Program;
    try {
        ast = Handlebars.parse(template);
    } catch {
        return null;
    }

    const offsets = lineOffsets(template);
    const tagAt = (loc: SourceLocation | undefined): string => {
        if (!loc) return '';
        const start = (offsets[loc.start.line - 1] ?? 0) + loc.start.column;
        const end = template.indexOf('}}', start);
        if (end < 0) return template.slice(start);
        return template.slice(start, template[end + 2] === '}' ? end + 3 : end + 2);
    };

    const references: HandlebarsVariableReference[] = [];
    const helperMisuses: HandlebarsHelperMisuse[] = [];
    const contexts: ContextKind[] = ['root'];
    const blockParams: Array<Set<string>> = [];
    let tag = '';

    const isBlockParam = (name: string): boolean => blockParams.some((scope) => scope.has(name));

    /** Record a data read of `path`, if it reads the root input. */
    const readData = (path: PathNode): void => {
        if (path.data) {
            // `@root.x` reads the input root; `@index`, `@key`, ... are runtime values.
            if (path.parts[0] === 'root' && path.parts.length > 1) {
                references.push({
                    name: path.parts[1],
                    expression: path.original,
                    hasPath: path.parts.length > 2,
                    tag,
                });
            }
            return;
        }
        if (path.parts.length === 0) return; // `this` / `.`
        const root = path.parts[0];
        if (path.depth === 0 && !isScoped(path) && isBlockParam(root)) return;
        // Handlebars stops at the root context when `../` goes past it.
        const context = contexts[Math.max(0, contexts.length - 1 - path.depth)];
        if (context !== 'root') return;
        references.push({ name: root, expression: path.original, hasPath: path.parts.length > 1, tag });
    };

    /** A path in argument position (params, hash values): Handlebars reads data, never calls a helper. */
    const visitArgument = (node: unknown): void => {
        if (isPath(node)) {
            const name = node.parts[0];
            // System variables are injected as data too, so they resolve as arguments.
            if (
                isSimpleId(node) &&
                !isBlockParam(name) &&
                isHandlebarsHelper(name) &&
                !isTemplateSystemVariable(name)
            ) {
                helperMisuses.push({ helper: name, problem: 'used_as_value', tag });
                return;
            }
            readData(node);
            return;
        }
        visit(node);
    };

    const visitCall = (n: Node): void => {
        const params = (n.params as unknown[] | undefined) ?? [];
        for (const p of params) visitArgument(p);
        const pairs = (n.hash as { pairs?: Array<{ value: unknown }> } | undefined)?.pairs ?? [];
        for (const pair of pairs) visitArgument(pair.value);
    };

    const hasArguments = (n: Node): boolean =>
        ((n.params as unknown[] | undefined)?.length ?? 0) > 0 ||
        ((n.hash as { pairs?: unknown[] } | undefined)?.pairs?.length ?? 0) > 0;

    const visit = (node: unknown): void => {
        if (!node || typeof node !== 'object') return;
        const n = node as Node;

        switch (n.type) {
            case 'Program': {
                for (const stmt of (n.body as unknown[] | undefined) ?? []) visit(stmt);
                break;
            }

            case 'MustacheStatement': {
                tag = tagAt(n.loc);
                const path = n.path;
                if (hasArguments(n)) {
                    // `{{helper arg}}`: the head is a helper name (a missing one fails the render check).
                    visitCall(n);
                } else if (isPath(path)) {
                    // A bare `{{name}}` calls a helper of that name when there is one, else reads data.
                    // System variables are helpers returning their injected value, meant to be used bare.
                    const name = path.parts[0];
                    if (isSimpleId(path) && !isBlockParam(name) && isHandlebarsHelper(name)) {
                        if (!isTemplateSystemVariable(name)) {
                            helperMisuses.push({ helper: name, problem: 'missing_arguments', tag });
                        }
                    } else {
                        readData(path);
                    }
                } else {
                    visit(path);
                }
                break;
            }

            case 'BlockStatement': {
                tag = tagAt(n.loc);
                const path = n.path;
                const helper = isPath(path) && isSimpleId(path) ? path.parts[0] : undefined;
                let itemContext: boolean;
                if (hasArguments(n) || (helper && isHandlebarsHelper(helper))) {
                    visitCall(n);
                    itemContext = !!helper && HANDLEBARS_CONTEXT_HELPERS.includes(helper);
                } else {
                    // `{{#section}}…{{/section}}` over data: iterates or enters `section`.
                    if (isPath(path)) readData(path);
                    itemContext = true;
                }

                const program = n.program as { blockParams?: string[] } | undefined;
                const inverse = n.inverse as { blockParams?: string[] } | undefined;
                blockParams.push(new Set(program?.blockParams ?? []));
                contexts.push(itemContext ? 'item' : contexts[contexts.length - 1]);
                visit(n.program);
                contexts.pop();
                blockParams.pop();

                // `{{else}}` renders with the enclosing context.
                blockParams.push(new Set(inverse?.blockParams ?? []));
                visit(n.inverse);
                blockParams.pop();
                break;
            }

            case 'SubExpression': {
                // `(helper arg)`: the head is a call, like a bare `{{helper}}`.
                visitCall(n);
                break;
            }

            // ContentStatement, CommentStatement, literals, partials — no variables.
            default:
                break;
        }
    };

    visit(ast);
    return { references, helperMisuses };
}

/**
 * Extract the set of root-level input variable names a Handlebars template reads.
 *
 * - `{{foo}}` → `foo`; `{{obj.bar.baz}}` → `obj`
 * - `{{#each items as |item|}}{{item.name}}{{/each}}` → `items` (`item` is a block param)
 * - `{{lookup obj key}}` → `obj`, `key` (helper name skipped)
 * - `{{@index}}`, `{{this}}`, and bare names inside `#each`/`#with` → ignored
 *
 * Returns an empty set on parse failure.
 */
export function extractHandlebarsVariables(template: string): Set<string> {
    const analysis = analyzeHandlebarsTemplate(template);
    return new Set(analysis?.references.map((r) => r.name) ?? []);
}
