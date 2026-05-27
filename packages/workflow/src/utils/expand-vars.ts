
const VARS_RX = /\${\s*([^}]+)\s*}/g;

/**
 * Given an expression containing ${name} variables, replace them with the properties from the vars object.
 * Nested property paths are also supported, e.g. ${section.name}
 * @param expr
 * @param vars
 */
export function expandVars(expr: string, vars: Record<string, unknown>) {
    return expr.replace(VARS_RX, (_: string, name: string) => {
        const path = name.split('.');
        const value = resolveProp(vars, path);
        if (value === undefined) {
            return `${name}`; // return back the expression
        } else {
            return String(value);
        }
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object';
}

function resolveProp(object: Record<string, unknown>, path: string[]) {
    let value: unknown = object;
    for (const part of path) {
        if (!isRecord(value)) {
            return undefined;
        }
        value = value[part];
    }
    return value;
}
