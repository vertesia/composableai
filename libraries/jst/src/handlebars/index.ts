import Handlebars from 'handlebars';
import { LRUCache } from 'lru-cache';
import { TEMPLATE_SYSTEM_VARIABLE_NAMES } from '../system.js';

/**
 * System variables (see ../system.ts) are injected into the template data. Each one is also
 * registered as a helper returning that injected value, because Handlebars resolves a name
 * differently by position: a bare `{{_now}}` or a subexpression `(_now)` looks up helpers first,
 * while an argument (`{{#if _now}}`) reads the data only. Registering both makes every position
 * render the same value. `_now` falls back to the current time when no value was injected, which
 * keeps templates rendered by callers that do not inject system variables working.
 */
function systemVariableHelper(name: string): Handlebars.HelperDelegate {
    return (...args: unknown[]) => {
        const options = args[args.length - 1] as Handlebars.HelperOptions | undefined;
        const root: unknown = options?.data?.root;
        const value = root && typeof root === 'object' ? (root as Record<string, unknown>)[name] : undefined;
        if (value !== undefined && value !== null) {
            return value;
        }
        return name === '_now' ? new Date().toISOString() : '';
    };
}

function stringifyHelper(value: unknown): string | Handlebars.SafeString {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return new Handlebars.SafeString(JSON.stringify(value));
}

const CUSTOM_HELPERS: Record<string, Handlebars.HelperDelegate> = {
    ...Object.fromEntries(TEMPLATE_SYSTEM_VARIABLE_NAMES.map((name) => [name, systemVariableHelper(name)])),
    stringify: stringifyHelper,
};

/**
 * Prompt templates render with a private Handlebars environment, so helpers another module
 * registers on the global instance never become available to prompts without the validator
 * knowing about them.
 */
const promptHandlebars = Handlebars.create();

/**
 * Prompts are plain text sent to a model, not HTML, so `{{value}}` inserts the value as it is. With
 * Handlebars' default HTML escaping, every quote, apostrophe, `&`, `<`, `>`, `=` and backtick in an input
 * reached the model as an entity (`&quot;`, `&#x27;`, ...): it changed what users wrote, garbled JSON
 * inputs, and multiplied their token count. `{{{value}}}` renders the same as `{{value}}`.
 */
const PROMPT_COMPILE_OPTIONS = { noEscape: true } as const;
for (const [name, helper] of Object.entries(CUSTOM_HELPERS)) {
    promptHandlebars.registerHelper(name, helper);
    // Kept on the global instance for code that compiled templates with the global Handlebars
    // after importing this module, which used to be where these helpers were registered.
    Handlebars.registerHelper(name, helper);
}

/**
 * Every helper available to prompt templates: Handlebars' built-ins (`if`, `each`, `with`,
 * `lookup`, ...) plus the custom ones above. Read from the environment itself so it cannot drift.
 */
export const HANDLEBARS_HELPER_NAMES: readonly string[] = Object.keys(promptHandlebars.helpers)
    // Internal fallbacks Handlebars invokes itself; templates never call them by name.
    .filter((name) => name !== 'helperMissing' && name !== 'blockHelperMissing')
    .sort();

const HELPER_NAME_SET: ReadonlySet<string> = new Set(HANDLEBARS_HELPER_NAMES);

export function isHandlebarsHelper(name: string): boolean {
    return HELPER_NAME_SET.has(name);
}

/** Built-in block helpers that render their block with a new context (`this` is the item). */
export const HANDLEBARS_CONTEXT_HELPERS: readonly string[] = ['each', 'with'];

/**
 * Compiled prompt templates keyed by their full source. Compiling a long template takes tens of
 * milliseconds and used to happen on every render, blocking the event loop. Templates compile with
 * the same options in the single `promptHandlebars` environment, so the source alone decides the
 * compiled result. Helpers and partials are looked up in that environment when a template renders,
 * not when it compiles, so a cached template always sees the environment's current helpers.
 *
 * Bounded at 1,000,000 characters of template source (about 25 MB of compiled templates) and 1,000
 * templates. The least recently used templates are evicted first. A larger template counts as the
 * whole budget: it evicts every other template and is cached on its own, since the longest templates
 * are the slowest to compile. Exported for tests; not part of the package API.
 */
const MAX_CACHED_TEMPLATE_CHARS = 1_000_000;
export const compiledTemplates = new LRUCache<string, Handlebars.TemplateDelegate>({
    max: 1000,
    maxSize: MAX_CACHED_TEMPLATE_CHARS,
    // An empty template still takes one unit: lru-cache requires a positive size.
    sizeCalculation: (_compiled, template) => Math.max(1, Math.min(template.length, MAX_CACHED_TEMPLATE_CHARS)),
});

export function renderHandlebarsTemplate(template: string, input: unknown): string {
    let compiled = compiledTemplates.get(template);
    if (!compiled) {
        compiled = promptHandlebars.compile(template, PROMPT_COMPILE_OPTIONS);
        compiledTemplates.set(template, compiled);
    }
    return compiled(input);
}
