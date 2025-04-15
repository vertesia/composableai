import assert from "assert";
import { FetchClient } from '../src/index.js';
import { KoaServer } from '@koa-stack/server';
import Endpoints from './endpoints.js';

const PORT = 7777;
const server = new KoaServer();

server.mount('/api/v1', Endpoints)

before(() => {
    server.start(PORT);
});

after(() => {
    server.stop();
});

const client = new FetchClient(`http://localhost:${PORT}/api/v1`).withHeaders({
    "authorization": "Bearer 1234"
});

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
    it('handles xml content', done => {
        client.get('/xml').then((payload) => {
            assert(payload === "<document></document>");
            done();
        }).catch(done);
    });

});


