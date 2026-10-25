import { gzipSync } from 'node:zlib';
import { LazyBody } from '@koa-stack/body';
import Koa from 'koa';
import request from 'supertest';
import { describe, expect, test } from 'vitest';

function createApp(json?: (raw: string) => unknown) {
    const app = new Koa();
    LazyBody.install(app, json ? { json } : {});
    app.use(async (ctx) => {
        const payload = await ctx.payload;
        ctx.body = { data: payload.json };
    });
    return app.callback();
}

describe('Malformed request bodies', () => {
    test('a well-formed JSON body parses', async () => {
        const res = await request(createApp()).post('/').set('Content-Type', 'application/json').send('{"a":1}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: { a: 1 } });
    });

    test('malformed JSON answers 400 with the parser reason', async () => {
        const res = await request(createApp()).post('/').set('Content-Type', 'application/json').send('{\n  a: 1\n}');
        expect(res.status).toBe(400);
        expect(res.text).toMatch(/^Invalid JSON request body: /);
    });

    test('a custom parser error without a status answers 400', async () => {
        const app = createApp(() => {
            throw new Error('unsupported shape');
        });
        const res = await request(app).post('/').set('Content-Type', 'application/json').send('{"a":1}');
        expect(res.status).toBe(400);
        expect(res.text).toBe('Invalid JSON request body: unsupported shape');
    });

    test('a custom parser error keeps its HTTP status', async () => {
        const app = createApp(() => {
            throw Object.assign(new Error('Too deeply nested'), { status: 422, expose: true });
        });
        const res = await request(app).post('/').set('Content-Type', 'application/json').send('{"a":1}');
        expect(res.status).toBe(422);
        expect(res.text).toBe('Too deeply nested');
    });

    test('a multipart body without a boundary answers 400', async () => {
        const res = await request(createApp()).post('/').set('Content-Type', 'multipart/form-data').send('a=1');
        expect(res.status).toBe(400);
        expect(res.text).toBe('bad content-type header, no multipart boundary');
    });

    test('does not reuse Content-Length for a later compressed request', async () => {
        const koa = new Koa();
        LazyBody.install(koa);
        koa.use(async (ctx) => {
            ctx.body = (await ctx.payload).text;
        });
        const app = koa.callback();
        await request(app).post('/').set('Content-Type', 'text/plain').send('short').expect(200);

        const text = 'a different uncompressed length';
        const res = await request(app)
            .post('/')
            .set('Content-Type', 'application/octet-stream')
            .set('Content-Encoding', 'gzip')
            .send(gzipSync(text))
            .expect(200);

        expect(res.text).toBe(text);
    });
});
