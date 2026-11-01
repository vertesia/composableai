import { describe, expect, it } from 'vitest';
import { get, routes } from '../src/decorators.js';
import { EndpointRoute, type RegisteredRoute, Resource, Router, ServeRoute } from '../src/router.js';

class BaseResource extends Resource {
    @get('/')
    async read() {
        return 'base';
    }
}

class ChildResource extends BaseResource {
    @get('/new', { version: 20260101 })
    async readNew() {
        return 'new';
    }
}

@routes({ '/children': ChildResource, '/alias': ChildResource })
class RootResource extends Resource {}

describe('route registration initializers', () => {
    it('inherits through mounts and exposes original handler names and endpoint versions', () => {
        const captured: RegisteredRoute[] = [];
        const router = new Router().withRouteInitializer((route) => captured.push(route));
        const api = router.mount('/api', RootResource);
        expect(
            captured.map((route) => ({
                path: route.absPathPattern,
                handler: route instanceof EndpointRoute ? route.handlerName : undefined,
                version: route instanceof EndpointRoute ? route.version : undefined,
            })),
        ).toEqual(
            expect.arrayContaining([
                { path: '/api/children', handler: 'read', version: undefined },
                { path: '/api/children/new', handler: 'readNew', version: 20260101 },
                { path: '/api/alias', handler: 'read', version: undefined },
            ]),
        );
        const child = api.routes.find((route) => route instanceof Router && route.prefix === '/children');
        if (!(child instanceof Router)) throw new Error('Missing child mount');
        expect([...child.route_versions['GET:/new']]).toEqual([
            captured.find((route) => route instanceof EndpointRoute && route.absPathPattern === '/api/children/new'),
        ]);
    });

    it('also observes static and later dynamic registrations', () => {
        const captured: RegisteredRoute[] = [];
        const router = new Router().withRouteInitializer((route) => captured.push(route));
        router.serve('/assets', './assets');
        const nested = router.mount('/dynamic');
        nested.get('/later', async () => 'late');
        expect(captured[0]).toBeInstanceOf(ServeRoute);
        expect(captured.map((route) => route.absPathPattern)).toEqual(['/assets', '/dynamic/later']);
    });
});
