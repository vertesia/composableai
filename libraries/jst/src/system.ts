/**
 * Registry of the values the prompt runtime supplies to every template, in addition to the
 * caller's input. This is the single source of truth: the renderer injects exactly these
 * names, the validator accepts exactly these names without a schema declaration, and tool
 * descriptions list them from here. Add a system variable here and nowhere else.
 */
export interface TemplateSystemVariable {
    /** Template name. Always starts with `_` so it cannot collide with ordinary schema properties. */
    name: string;
    /** JSON type of the injected value. */
    type: 'string';
    /** Human-readable description, surfaced in tool descriptions and validation messages. */
    description: string;
}

export const TEMPLATE_SYSTEM_VARIABLES = [
    {
        name: '_now',
        type: 'string',
        description: 'Current date and time as an ISO 8601 string (UTC)',
    },
    {
        name: '_model',
        type: 'string',
        description: 'Identifier of the model the prompt is executed with',
    },
] as const satisfies readonly TemplateSystemVariable[];

export type TemplateSystemVariableName = (typeof TEMPLATE_SYSTEM_VARIABLES)[number]['name'];

export const TEMPLATE_SYSTEM_VARIABLE_NAMES: readonly TemplateSystemVariableName[] = TEMPLATE_SYSTEM_VARIABLES.map(
    (v) => v.name,
);

const SYSTEM_VARIABLE_NAME_SET: ReadonlySet<string> = new Set(TEMPLATE_SYSTEM_VARIABLE_NAMES);

export function isTemplateSystemVariable(name: string): name is TemplateSystemVariableName {
    return SYSTEM_VARIABLE_NAME_SET.has(name);
}

/** Runtime context the system variable values are computed from. */
export interface TemplateSystemContext {
    /** Model id of the execution. `_model` is omitted when unknown. */
    model?: string;
    /** Reference time for `_now`. Defaults to the current time. */
    now?: Date;
}

/** Compute the system variable values for one rendering. */
export function buildTemplateSystemVariables(context: TemplateSystemContext = {}): Record<string, string> {
    const values: Record<string, string> = {
        _now: (context.now ?? new Date()).toISOString(),
    };
    if (context.model) {
        values._model = context.model;
    }
    return values;
}

/**
 * Return the template data with the system variables added. System values win over caller input
 * of the same name: the names are reserved, so a caller cannot spoof `_model` or `_now`.
 */
export function withTemplateSystemVariables(
    input: Record<string, unknown>,
    context: TemplateSystemContext = {},
): Record<string, unknown> {
    return { ...input, ...buildTemplateSystemVariables(context) };
}

/** One-line summary of the system variables, for tool descriptions and error messages. */
export function describeTemplateSystemVariables(): string {
    return TEMPLATE_SYSTEM_VARIABLES.map((v) => `${v.name} (${v.description})`).join(', ');
}
