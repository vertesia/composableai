import assert from 'node:assert';
import request from 'supertest';
import { describe, test } from 'vitest';

const server = 'http://localhost:9098';

describe('Test router resources inheritance', () => {
    test('return from endpoint set the payload', async () => {
        const res = await request(server).get('/api/return').expect(200);
        assert.equal(res.text, 'returned payload');
    });

    test('can define own endpoint', async () => {
        const res = await request(server).get('/api/hello').expect(200);
        assert.equal(res.text, 'hello');
    });

    test('can define base endpoint', async () => {
        const res = await request(server).get('/api/base').expect(200);
        assert.equal(res.text, 'hello base');
    });

    test('can overwrite base endpoint method', async () => {
        const res = await request(server).get('/api/overwrite').expect(200);
        assert.equal(res.text, 'ApiRoot overwrite');
    });

    test('can overwrite base access guard method', async () => {
        const res = await request(server).get('/api/hello').expect(200);
        assert.equal(res.text, 'hello');
        assert.equal(res.header['on-access'], 'ApiRoot');
    });

    test('can overwrite base access guard decorator', async () => {
        const res = await request(server).get('/api-bad').expect(200);
        assert.equal(res.text, 'ApiRootBad root');
    });

    test('can overwrite base endpoint decorator', async () => {
        const res = await request(server).get('/api-bad/overwrite').expect(200);
        assert.equal(res.text, 'ApiRootBad overwrite');
    });

    test('own decorators are not modifying base resource routes', async () => {
        await request(server).get('/api-bad/hello').expect(404);
    });

    test('base access guard is inherited', async () => {
        const res = await request(server).get('/api-other/').expect(200);
        assert.equal(res.text, 'OtherApi root');
        assert.equal(res.header['on-access'], 'BaseResource');
    });

    test('access guard is working', async () => {
        await request(server).get('/api-other/').set('authorization', 'none').expect(401);
    });

    test('@routes is working given a resource class', async () => {
        const res = await request(server).get('/api-other/users1').expect(200);
        assert.equal(res.text, 'UsersApi root');
    });

    test('@routes is working given a resource instance', async () => {
        const res = await request(server).get('/api-other/users2').expect(200);
        assert.equal(res.text, 'UsersApi root');
    });

    test('setup is working', async () => {
        const res = await request(server).get('/api-other/users3').expect(200);
        assert.equal(res.text, 'UsersApi root');
    });

    test('@serve on exact path is working', async () => {
        const res = await request(server).get('/api-other/index.txt').expect(200);
        assert.equal(res.text, 'index.txt');
    });

    test('@serve on prefix path is working', async () => {
        const res = await request(server).get('/api-other/static/hello.txt').expect(200);
        assert.equal(res.text, 'hello.txt');
    });

    test('@filters is working', async () => {
        await request(server).get('/api-other/noContent').expect(204);
    });
});
