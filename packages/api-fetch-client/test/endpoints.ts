import { Resource, type Router } from '@koa-stack/router';
import type { Context } from 'koa';
import { FetchClient } from '../src/index.js';

export default class Endpoints extends Resource {
    setup(router: Router) {
        router.get('/', this.getRoot, this);
        router.get('/token', this.getAuthToken, this);
        router.get('/html', this.getHTML, this);
        router.get('/html-error', this.getHTMLError, this);
        router.get('/no-content', this.getNoContent, this);
        router.get('/echo-query', this.getEchoQuery, this);
        router.get('/relay-html', this.getRelayHTML, this);
    }

    async getRoot(_ctx: Context) {
        return { message: 'Hello World!' };
    }

    async getAuthToken(ctx: Context) {
        const token = (ctx.headers.authorization as string).split(' ')[1];
        return { token };
    }

    async getHTML(ctx: Context) {
        ctx.response.type = 'html';
        return '<html><body>Hello!</body></html>';
    }

    async getHTMLError(ctx: Context) {
        ctx.response.type = 'html';
        ctx.status = 401;
        return '<html><body>Error!</body></html>';
    }

    async getNoContent(ctx: Context) {
        ctx.response.type = 'html';
        ctx.status = 204;
    }

    /** Echoes `ctx.query` so a test can assert what a real server parses out of the wire format. */
    async getEchoQuery(ctx: Context) {
        return { query: ctx.query, search: ctx.querystring };
    }

    /** Relays a call to an upstream that answers 200 with an HTML page, letting its error propagate. */
    async getRelayHTML(_ctx: Context) {
        const upstream = new FetchClient('http://upstream.test', async () => {
            return new Response('<html><body>App shell</body></html>', {
                status: 200,
                headers: { 'content-type': 'text/html' },
            });
        });
        return upstream.get('/list');
    }
}
