import Handlebars from 'handlebars';
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

export function renderHandlebarsTemplate(template: string, input: unknown): string {
    const compiled = promptHandlebars.compile(template);
    return compiled(input);
}
