export function buildQueryString(query: Record<string, unknown>) {
    const parts = [];
    for (const key of Object.keys(query)) {
        const val = query[key];
        if (val != null) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
        }
    }
    return parts.join('&');
}

export function join(left: string, right: string) {
    if (left.endsWith('/')) {
        if (right.startsWith('/')) {
            return left + right.substring(1);
        } else {
            return left + right;
        }
    } else if (right.startsWith('/')) {
        return left + right;
    } else {
        return `${left}/${right}`;
    }
}
export function removeTrailingSlash(path: string) {
    if (path[path.length - 1] === '/') {
        return path.slice(0, -1);
    }
    return path;
}
