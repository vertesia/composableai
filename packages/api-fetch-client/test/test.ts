import assert from "assert";
import { FetchClient } from '../src/index.js';
import { KoaServer } from '@koa-stack/server';
import Endpoints from './endpoints.js';

const HOST = "127.0.0.1";
const server = new KoaServer();

server.mount('/api/v1', Endpoints)

let client: FetchClient;

before(async () => {
    await server.start(0, { host: HOST });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Unable to resolve test server address');
    }
    client = new FetchClient(`http://${HOST}:${address.port}/api/v1`).withHeaders({
        "authorization": "Bearer 1234"
    });
});

after(() => server.stop());

describe('Test requests', () => {
    it('get method works', done => {
        client.get('/').then((payload: any) => {
            assert(payload.message === "Hello World!");
            done();
        }).catch(done);
    });
    it('withHeaders works', done => {
        client.get('/token').then((payload: any) => {
            assert(payload.token === "1234");
            done();
        }).catch(done);
    });
    it('handles incorrect content type', done => {
        client.get('/html').then((payload: any) => {
            assert(payload.text === "<html><body>Hello!</body></html>");
            done();
        }).catch(done);
    });
    it('handles errors in incorrect content type', done => {
        client.get('/html-error').catch((err: any) => {
            assert(err.payload.text === "<html><body>Error!</body></html>");
            assert(err.status === 401);
            assert(err.original_message.startsWith("Server Error: 401"));
            assert(err.original_message.includes("non-JSON response"));
            assert(!err.message.includes("Unexpected token"));
            done();
        }).catch(done);
    });
    it('handles no content', done => {
        client.get('/no-content').then((payload) => {
            assert(payload === undefined);
            assert(client.response?.status === 204);
            done();
        }).catch(done);
    });
});
