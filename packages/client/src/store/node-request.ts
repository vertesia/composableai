/**
 * Large signed-URL uploads in Node.js, sent with Node's own `http`/`https` client instead of `fetch`.
 *
 * Node's `fetch` keeps every chunk of a streamed request body in memory until the request completes, so uploading a
 * file through it costs the file's size in memory even when the body is a stream or a file-backed `Blob`. `http`
 * writes the body with backpressure and releases each chunk once it is sent.
 *
 * The Node modules are imported on first use, so this file is safe to load in a browser, which never calls it.
 */

/** Whether this runtime has Node's `http` client (Node.js, and runtimes compatible with it such as Bun). */
export function hasNodeHttp(): boolean {
    return typeof process !== 'undefined' && typeof process.versions?.node === 'string';
}

type WebReadableStream = Parameters<typeof import('node:stream').Readable.fromWeb>[0];

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/**
 * Send a request with a `Blob` or `ReadableStream` body. A `Blob` is sent with its size as `Content-Length`; a
 * stream of unknown length is sent with chunked transfer encoding. Resolves with the response once its headers
 * arrive, like `fetch`; rejects on a connection error.
 */
export async function nodeRequest(
    url: string,
    init: { method: string; headers?: Record<string, string>; body: Blob | ReadableStream },
): Promise<Response> {
    const [http, https, { Readable }, { pipeline }] = await Promise.all([
        import('node:http'),
        import('node:https'),
        import('node:stream'),
        import('node:stream/promises'),
    ]);
    const { body } = init;
    const headers: Record<string, string> = { ...init.headers };
    if (body instanceof Blob) {
        headers['content-length'] = String(body.size);
    }
    const target = new URL(url);
    const send = target.protocol === 'http:' ? http.request : https.request;

    return new Promise<Response>((resolve, reject) => {
        const req = send(target, { method: init.method, headers });
        req.on('response', (res) => {
            const responseHeaders = new Headers();
            for (const [name, value] of Object.entries(res.headers)) {
                if (value === undefined) continue;
                for (const v of Array.isArray(value) ? value : [value]) responseHeaders.append(name, v);
            }
            const status = res.statusCode ?? 0;
            const responseBody = NULL_BODY_STATUSES.has(status)
                ? null
                : (Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>);
            if (!responseBody) res.resume();
            resolve(new Response(responseBody, { status, statusText: res.statusMessage, headers: responseHeaders }));
        });
        const source = Readable.fromWeb((body instanceof Blob ? body.stream() : body) as WebReadableStream);
        // An error reading the body ends the request with a "socket hang up"; report the body's error instead.
        let bodyError: unknown;
        source.once('error', (err) => {
            bodyError = err;
        });
        req.on('error', (err) => reject(bodyError ?? err));
        pipeline(source, req).catch((err: unknown) => reject(bodyError ?? err));
    });
}
