/**
 * Convert a name to a URL-safe path segment.
 * If the name contains spaces or underscores, convert to PascalCase.
 * Otherwise return as-is. Any characters not in [a-zA-Z0-9$_\-@] are replaced with '-'.
 */
export function toPathName(name: string): string {
    let result = name;
    if (result.includes(' ') || result.includes('_')) {
        result = result.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    }
    return result.replace(/[^a-zA-Z0-9$_\-@]/g, '-');
}

export function kebabCaseToTitle(name: string) {
    return name.split('-').map(p => p[0].toUpperCase() + p.substring(1)).join(' ');
}

export function makeScriptUrl(origin: string, script: string) {
    return join(origin, join("/scripts", script));
}

export function join(left: string, right: string) {
    if (left.endsWith('/')) {
        if (right.startsWith('/')) {
            return left + right.slice(1);
        } else {
            return left + right;
        }
    } else if (right.startsWith('/')) {
        return left + right;
    } else if (right.startsWith('./')) {
        return left + '/' + right.slice(2);
    } else {
        return left + '/' + right;
    }
}

