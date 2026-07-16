import type { Context } from 'koa';
import { describe, expect, it } from 'vitest';
import { type ErrorObject, errorHandler } from './error.js';
import { ServerError } from './ServerError.js';

/**
 * Minimal Koa context that captures the serialized error body written by `errorHandler`.
 * `accepts()` always resolves to JSON so the JSON serializer runs.
 */
function createMockContext() {
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
        accepts: () => 'json',
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
