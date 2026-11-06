/**
 * Large signed-URL uploads in Node.js, sent with Node's own `http`/`https` client instead of `fetch`.
 *
 * Node's `fetch` keeps every chunk of a streamed request body in memory until the request completes, so uploading a
 * file through it costs the file's size in memory even when the body is a stream or a file-backed `Blob`. `http`
 * writes the body with backpressure and releases each chunk once it is sent.
 *
 * Node.js only. Browser bundles get `node-request.browser.ts` instead, through the `browser` field of `package.json`,
 * so they never resolve the Node modules this file imports.
 */
import { ContentLengthMismatchError, contentLengthHeader } from './upload-runtime.js';

export { ContentLengthMismatchError, hasNodeHttp } from './upload-runtime.js';

type WebReadableStream = Parameters<typeof import('node:stream').Readable.fromWeb>[0];

/**
 * A pass-through that fails once more than `length` bytes go through it, or when it ends with fewer. The chunk that
 * completes `length` is held until the source ends, so the server never receives a complete body from a stream
 * that turns out to be longer.
 */
export function exactLength(length: number, TransformClass: typeof import('node:stream').Transform) {
    let seen = 0;
    let last: Buffer | undefined;
    return new TransformClass({
        transform(chunk: Buffer, _encoding, callback) {
            seen += chunk.byteLength;
            if (seen > length) {
                callback(new ContentLengthMismatchError(length, seen, 'long'));
            } else if (seen === length) {
                last = chunk;
                callback();
            } else {
                callback(null, chunk);
            }
        },
        flush(callback) {
            if (seen < length) {
                callback(new ContentLengthMismatchError(length, seen, 'short'));
            } else {
                callback(null, last);
            }
        },
    });
}

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/** How long the connection may stay idle before the request fails: the headers and body timeouts of undici's fetch. */
const IDLE_TIMEOUT_MS = 300_000;

/**
 * Send a request with a `Blob` or `ReadableStream` body. A `Blob` is sent with its size as `Content-Length`; a
 * stream with the `Content-Length` header it is given, or with chunked transfer encoding when it has none. A body
 * that ends short of its `Content-Length` or runs past it fails the request. Resolves with the response once its
 * headers arrive, like `fetch`; rejects on a connection error, or when the connection is idle for `idleTimeoutMs`.
 */
export async function nodeRequest(
    url: string,
    init: { method: string; headers?: Record<string, string>; body: Blob | ReadableStream; idleTimeoutMs?: number },
): Promise<Response> {
    const [http, https, { Readable, Transform }, { pipeline }] = await Promise.all([
        import('node:http'),
        import('node:https'),
        import('node:stream'),
        import('node:stream/promises'),
    ]);
    const { body } = init;
    const headers: Record<string, string> = { ...init.headers };
    if (body instanceof Blob) {
        for (const name of Object.keys(headers)) {
            if (name.toLowerCase() === 'content-length') delete headers[name];
        }
        headers['content-length'] = String(body.size);
    }
    const target = new URL(url);
    const send = target.protocol === 'http:' ? http.request : https.request;

    return new Promise<Response>((resolve, reject) => {
        const req = send(target, { method: init.method, headers });
        const idleTimeoutMs = init.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
        req.setTimeout(idleTimeoutMs, () => {
            req.destroy(new Error(`Request to ${target.host} was idle for ${idleTimeoutMs} ms`));
        });
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
            try {
                resolve(
                    new Response(responseBody, { status, statusText: res.statusMessage, headers: responseHeaders }),
                );
            } catch (err: unknown) {
                // A status or reason phrase `Response` does not accept: fail the request, not the event loop.
                res.destroy();
                reject(err);
            }
        });
        const source = Readable.fromWeb((body instanceof Blob ? body.stream() : body) as WebReadableStream);
        // An error reading the body ends the request with a "socket hang up"; report the body's error instead.
        let bodyError: unknown;
        source.once('error', (err) => {
            bodyError = err;
        });
        req.on('error', (err) => reject(bodyError ?? err));
        // A stream that does not match its declared length aborts the request instead of sending a truncated or
        // overlong body. (`strictContentLength` reports a short body from `end()` outside the pipeline, as an
        // uncaught exception, so the length is checked here.)
        const length = contentLengthHeader(headers);
        const stages = length === undefined ? [source] : [source, exactLength(length, Transform)];
        pipeline([...stages, req]).catch((err: unknown) => reject(bodyError ?? err));
    });
}
