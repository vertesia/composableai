/**
 * Serializes a query object into a query string.
 *
 * An array value is emitted as a repeated key — `{tags: ['a', 'b']}` becomes `tags=a&tags=b` — which
 * is what OpenAPI's default for a query parameter, `style: form` with `explode: true`, describes, and
 * therefore what the published spec has always promised and what the generated Java and Python
 * clients already send.
 *
 * This used to be `String(val)`, which turns an array into its comma-joined `toString()`. That form
 * is not what the spec declares, and it is ambiguous in a way the repeated key is not: `['a,b']` and
 * `['a', 'b']` went out as the same request, so a value legitimately containing a comma — a tag, a
 * search term, a sort expression — was not expressible. It also silently mangled anything
 * non-primitive, since `String({})` is `[object Object]`.
 *
 * That ambiguity is only half resolved today: servers still split each occurrence on commas so that
 * SDKs pinned to an older version keep working, so a comma inside a value is preserved on the wire
 * but not yet through the parse. Retiring the comma-joined form on the server side is what closes it.
 *
 * Servers accept both forms (see `queryStringList` in `@dglabs/server-common`), so an SDK on either
 * side of this change talks to a current server correctly. The ordering constraint is the other way
 * round: a server must be able to read repeated keys BEFORE an SDK that sends them is published.
 */
export function buildQueryString(query: Record<string, unknown>) {
    const parts = [];
    for (const key of Object.keys(query)) {
        const val = query[key];
        if (val == null) continue;
        const encodedKey = encodeURIComponent(key);
        // A nullish element is dropped rather than sent as "null"/"undefined", matching how a nullish
        // parameter is dropped entirely.
        for (const item of Array.isArray(val) ? val : [val]) {
            if (item == null) continue;
            parts.push(`${encodedKey}=${encodeURIComponent(String(item))}`);
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
