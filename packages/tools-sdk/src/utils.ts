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
