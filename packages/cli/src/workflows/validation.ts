import type { DSLActivitySpec, DSLWorkflowSpec, DSLWorkflowStep } from '@vertesia/common';

export class ValidationError extends Error {
    constructor(message: string) {
        super(`Invalid workflow definition: ${message}`);
        this.name = 'ValidationError';
    }
}

/**
 * Validates a DSL workflow definition and prints its errors.
 * @throws ValidationError when the definition has errors
 */
export function validateWorkflow(spec: DSLWorkflowSpec): DSLWorkflowSpec {
    const errors = getWorkflowErrors(spec);
    if (errors.length > 0) {
        console.log('');
        console.log('# ');
        console.log('# The workflow has validation errors:');
        console.log('# ');
        console.log('');
        console.log(errors.map((v, i) => `${i + 1}. ${v}`).join('\n'));
        console.log('');
        throw new ValidationError('Exiting because of validation errors.');
    }
    return spec;
}

/**
 * Checks the structure of a DSL workflow definition and the variables its activities reference.
 * Mirrors the checks of the workflow runtime's DSL validator without depending on the runtime.
 */
export function getWorkflowErrors(workflow: DSLWorkflowSpec, vars: string[] = []): string[] {
    const errors: string[] = [];
    const workflowVars = new Set(vars);
    workflowVars.add('objectId');
    workflowVars.add('objectIds');
    if (workflow.vars) {
        for (const v of Object.keys(workflow.vars)) {
            workflowVars.add(v);
        }
    }
    if (!workflow.name) {
        errors.push("Workflow 'name' property is required");
    }
    if (workflow.steps && workflow.activities) {
        errors.push("You must use either 'steps' or 'activities'. You cannot use both. Prefer using steps.");
        return errors;
    }
    if (!workflow.steps && !workflow.activities) {
        errors.push("The workflow requires one of 'steps' or 'activities' properties. Neither is present.");
        return errors;
    }
    const stepsPropName = workflow.steps ? 'steps' : 'activities';
    const steps = workflow.steps || workflow.activities;
    if (!Array.isArray(steps)) {
        errors.push(`Workflow '${stepsPropName}' should be an array`);
        return errors;
    }
    if (!steps.length) {
        errors.push('Workflow should have at least one step or activity');
    }

    const activities: DSLActivitySpec[] =
        stepsPropName === 'steps' ? (steps as DSLWorkflowStep[]).filter((s) => s.type === 'activity') : steps;
    for (const activity of activities) {
        for (const err of getActivityErrors(activity, workflowVars)) {
            errors.push(`Activity "${activity.name}": ${err}`);
        }
        if (activity.output) {
            workflowVars.add(activity.output);
        }
    }
    return errors;
}

function getActivityErrors(activity: DSLActivitySpec, workflowVars: Set<string>): string[] {
    const errors: string[] = [];
    if (!activity.name) {
        errors.push('Activity name is required');
    }
    const localVars = new Set<string>();
    for (const entry of activity.import ?? []) {
        if (typeof entry === 'string') {
            // the runtime imports `name!` (a required import) as `name`
            const path = stripRequiredMarker(entry);
            addLocalVar(path, localVars, errors);
            if (!workflowVars.has(path)) {
                errors.push(`Unknown workflow variable "${entry}" in import declaration`);
            }
        } else {
            for (const key of Object.keys(entry)) {
                addLocalVar(key, localVars, errors);
                const wfExpr = entry[key];
                if (!workflowVars.has(splitPath(stripRequiredMarker(wfExpr))[0])) {
                    errors.push(`Unknown workflow variable "${wfExpr}" in import declaration`);
                }
            }
        }
    }

    // fetch queries see the imported vars; the fetched names are visible to the params
    if (activity.fetch) {
        const keys = Object.keys(activity.fetch);
        for (const key of keys) {
            checkReferences(activity.fetch[key].query, localVars, errors);
        }
        for (const key of keys) {
            addLocalVar(key, localVars, errors);
        }
    }
    if (activity.params) {
        checkReferences(activity.params, localVars, errors);
        // a self reference such as `"object_type": "${object_type}"` never resolves
        for (const [key, value] of Object.entries(activity.params)) {
            if (typeof value === 'string' && value.includes(`\${${key}}`)) {
                errors.push(`Self referencing parameter "${key}" in expression "${value}"`);
            }
        }
    }
    return errors;
}

function addLocalVar(name: string, localVars: Set<string>, errors: string[]) {
    if (localVars.has(name)) {
        errors.push(`Duplicate variable "${name}"`);
    }
    localVars.add(name);
}

function stripRequiredMarker(path: string): string {
    return path.endsWith('!') ? path.slice(0, -1) : path;
}

function splitPath(path: string): string[] {
    return path.replace(/\[(\d+)\]/g, '.$1').split('.');
}

const FALLBACK_SEPARATOR = '??';

/**
 * Extracts the references of an expression string the way the workflow runtime does:
 * `${a} and ${b}` is split on each `${…}`, and a string holding `${` without a closing `}`
 * is read as a single reference.
 */
function getReferences(value: string): string[] {
    if (!value.includes('${')) {
        return [];
    }
    const segments = value.split(/(\${[^}]+})/);
    if (segments.length === 1) {
        return [value.substring(2, value.length - 1)];
    }
    return segments.filter((seg) => seg.startsWith('${') && seg.endsWith('}')).map((seg) => seg.slice(2, -1));
}

/** The fallback literal after `??`: JSON, or a single-quoted string. */
function decodeFallbackLiteral(value: string): void {
    if (value.startsWith("'") && value.endsWith("'")) {
        value = `"${value.slice(1, -1).replace(/(?<!\\)"/g, '\\"')}"`;
    }
    JSON.parse(value);
}

/**
 * Parses one reference as the runtime does, returning its path or an error message.
 * Only a reference with a fallback is trimmed: `${ name }` names the variable ` name `.
 */
function parseReference(ref: string): { path: string[] } | { error: string } {
    const index = ref.indexOf(FALLBACK_SEPARATOR);
    if (index > -1) {
        const fallback = ref.substring(index + FALLBACK_SEPARATOR.length).trim();
        try {
            decodeFallbackLiteral(fallback);
        } catch {
            return { error: `Invalid fallback value "${fallback}" in reference "\${${ref}}"` };
        }
        ref = ref.substring(0, index).trim();
    }
    if (ref === '.' || ref.includes('..')) {
        return { error: `Invalid variable reference "${ref}"` };
    }
    return { path: splitPath(ref) };
}

/** Reports every reference, in any string nested in `target`, that is invalid or whose head is not a known variable. */
function checkReferences(target: unknown, known: Set<string>, errors: string[]) {
    if (typeof target === 'string') {
        for (const ref of getReferences(target)) {
            const parsed = parseReference(ref);
            if ('error' in parsed) {
                errors.push(`${parsed.error} in expression "${target}"`);
            } else if (!known.has(parsed.path[0])) {
                const name = parsed.path.join('.');
                errors.push(`Unknown variable "${name}" in expression "\${${name}}"`);
            }
        }
    } else if (Array.isArray(target)) {
        for (const item of target) {
            checkReferences(item, known, errors);
        }
    } else if (target && typeof target === 'object' && target.constructor === Object) {
        for (const value of Object.values(target)) {
            checkReferences(value, known, errors);
        }
    }
}
