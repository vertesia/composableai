import type { Context } from 'koa';
import { describe, expect, it } from 'vitest';
import { type ErrorObject, errorHandler } from './error.js';
import { ServerError } from './ServerError.js';

/**
 * Minimal Koa context that captures the serialized error body written by `errorHandler`.
 * `accepts()` always resolves to `accepted` (JSON by default) so that serializer runs.
 */
function createMockContext(accepted = 'json') {
    let body: string | undefined;
    const ctx = {
        res: {
            getHeader: () => undefined,
            getHeaderNames: () => [] as string[],
            removeHeader: () => {},
            setHeader: () => {},
            end: (content?: string) => {
                body = content;
            },
        },
        set: () => {},
        accepts: () => accepted,
        app: { emit: () => {} },
        headerSent: false,
        writable: true,
        type: '',
        status: 0,
        length: 0,
    } as unknown as Context;
    return { ctx, getBody: () => body };
}

function parseBody(body: string | undefined): Record<string, unknown> {
    if (body === undefined) throw new Error('no response body was written');
    return JSON.parse(body);
}

describe('errorHandler JSON serialization — expose vs errorCode', () => {
    it('serializes errorCode when the error is exposed and carries one', () => {
        const err = new ServerError('nope', 403);
        err.errorCode = 'restricted_environment';
        const { ctx, getBody } = createMockContext();

        errorHandler(ctx, err);

        const body = parseBody(getBody());
        expect(body.status).toBe(403);
        expect(body.errorCode).toBe('restricted_environment');
        // A ServerError is exposed by default, so the message is included too.
        expect(body.message).toBe('403 - nope');
    });

    it('omits errorCode when an exposed error does not set one', () => {
        const err = new ServerError('nope', 403);
        const { ctx, getBody } = createMockContext();

        errorHandler(ctx, err);

        const raw = getBody();
        expect(raw).not.toContain('errorCode');
        expect(parseBody(raw).errorCode).toBeUndefined();
    });

    it('does not serialize errorCode (nor message) when the error is not exposed', () => {
        // A non-exposed error still carries an errorCode, but the expose gate must withhold it —
        // the same gate that hides `message`/`details` from clients.
        const err = Object.assign(new Error('secret internal detail'), {
            statusCode: 403,
            expose: false,
            errorCode: 'restricted_environment',
        }) as ErrorObject;
        const { ctx, getBody } = createMockContext();

        errorHandler(ctx, err);

        const body = parseBody(getBody());
        expect(body.errorCode).toBeUndefined();
        expect(body.message).toBeUndefined();
        // Only the generic status text is exposed.
        expect(body.error).toBe('Forbidden');
        expect(body.status).toBe(403);
    });
});

describe('errorHandler markup serialization — escaping', () => {
    const payload = '<script>alert("x")</script> & \'quoted\'';

    function exposedError() {
        return Object.assign(new Error(payload), { statusCode: 404, expose: true }) as ErrorObject;
    }

    it('escapes the message in the HTML error page', () => {
        const { ctx, getBody } = createMockContext('html');

        errorHandler(ctx, exposedError());

        const body = getBody() ?? '';
        expect(ctx.type).toBe('text/html');
        expect(body).not.toContain('<script>');
        expect(body).not.toContain('"x"');
        expect(body).toContain('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;</p>');
        expect(body).toContain('<title>404 Not Found</title>');
    });

    it('escapes the title in the HTML error page', () => {
        const { ctx, getBody } = createMockContext('html');

        errorHandler(ctx, exposedError(), {
            updateErrorInfo: (_ctx, _err, info) => {
                info.error = '<b>"Bad"</b>';
            },
        });

        const body = getBody() ?? '';
        expect(body).not.toContain('<b>');
        expect(body).toContain('<title>404 &lt;b&gt;&quot;Bad&quot;&lt;/b&gt;</title>');
        expect(body).toContain('<h1>404 &lt;b&gt;&quot;Bad&quot;&lt;/b&gt;</h1>');
    });

    it('interpolates and escapes the XML error document', () => {
        const { ctx, getBody } = createMockContext('xml');

        errorHandler(ctx, exposedError(), {
            updateErrorInfo: (_ctx, _err, info) => {
                info.error = 'Not "Found"';
            },
        });

        expect(ctx.type).toBe('text/xml');
        expect(getBody()).toBe(
            '<?xml version="1.0" encoding="UTF-8"?><error status="404" code="Not &quot;Found&quot;">' +
                '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;</error>',
        );
    });

    it('writes an empty XML element when the message is not exposed', () => {
        const err = Object.assign(new Error(payload), { statusCode: 500, expose: false }) as ErrorObject;
        const { ctx, getBody } = createMockContext('xml');

        errorHandler(ctx, err);

        expect(getBody()).toBe(
            '<?xml version="1.0" encoding="UTF-8"?><error status="500" code="Internal Server Error"></error>',
        );
    });

    it('uses a custom XML formatter verbatim', () => {
        const { ctx, getBody } = createMockContext('xml');

        errorHandler(ctx, exposedError(), { xml: (info) => `<custom>${info.status}</custom>` });

        expect(getBody()).toBe('<custom>404</custom>');
    });
});
