import assert from 'node:assert';
import request from 'supertest';
import { describe, test } from 'vitest';

const server = 'http://localhost:9098';

describe('Test koaserver accept requests', () => {
    test('Accept requests', async () => {
        const res = await request(server).get('/').expect(200);
        assert.equal(res.text, 'hello');
    });
});

describe('Test body parsing', () => {
    test('ctx.hasPayload works', async () => {
        let res = await request(server).post('/api/optional-body').expect(200);
        assert.equal(res.text, 'no body');
        res = await request(server).post('/api/optional-body').send({ message: 'hello' }).expect(200);
        assert.equal(res.text, 'has body');
    });
    test('ctx.payload works with null body', async () => {
        const res = await request(server).post('/api/null-body').set('Content-Type', 'application/json').expect(200);
        assert.equal(res.text, 'null body');
    });
});

// describe('Test koaserver accept requests error content type', () => {

//     test('Accept */* => GET / => 404 as HTML', done => {
//         request(server).get('/').set('Accept', '*/*').expect(404).then(res => {
//             assert.ok(res.text.startsWith('<!DOCTYPE html>'));
//             done();
//         }).catch(err => done(err));
//     });
//     test('Accept application/json => GET / => 404', done => {
//         request(server).get('/').set('Accept', 'application/json').expect(404).then(res => {
//             assert.strictEqual(res.body.statusCode, 404);
//             done();
//         }).catch(err => done(err));
//     });
//     test('Accept text/htnl => GET / => 404', done => {
//         request(server).get('/').set('Accept', 'text/html').expect(404).then(res => {
//             assert.ok(res.text.startsWith('<!DOCTYPE html>'));
//             done();
//         }).catch(err => done(err));
//     });
//     test('Accept text/plain => GET / => 404', done => {
//         request(server).get('/').set('Accept', 'text/plain').expect(404).then(res => {
//             res.text.startsWith('404 ')
//             done();
//         }).catch(err => done(err));
//     });

//     test('Customize errors using a 404.html file', done => {
//         app.context.onerror = errorHandler({
//             html: __dirname + '/errors'
//         });
//         request(server).get('/').set('Accept', 'text/html').expect(404).then(res => {
//             assert.strictEqual(res.text, '<html><body>Oops!</body></html>');
//             done();
//         }).catch(err => done(err));
//     });

//     test('Customize HTML errors using a function', done => {
//         app.context.onerror = errorHandler({
//             html: (data, error, opts) => '<html><body>' + data.statusCode + '</body></html>'
//         });
//         request(server).get('/').set('Accept', 'text/html').expect(404).then(res => {
//             assert.strictEqual(res.text, '<html><body>404</body></html>');
//             done();
//         }).catch(err => done(err));
//     });

//     test('Customize JSON errors using a function', done => {

//         app.context.onerror = errorHandler({
//             json: (data, error, opts) => {
//                 return { status: data.statusCode }
//             }
//         });

//         request(server).get('/').set('Accept', 'application/json').expect(404).then(res => {
//             assert.strictEqual(res.body.status, 404);
//             done();
//         }).catch(err => done(err));
//     });

// });
