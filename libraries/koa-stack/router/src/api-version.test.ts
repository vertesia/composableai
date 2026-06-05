import { beforeEach, describe, expect, test } from 'vitest';
import type { EndpointRoute } from './router.js';
import { ApiVersion, EndpointVersions } from './version.js';

// Helper function to create mock versioned endpoint routes
function createMockRoute(version: number): any {
    return {
        version,
        key: `GET:/test`,
        pathPattern: '/test',
        method: 'GET',
        absPathPattern: '/test',
    };
}

// Helper function to create mock default route
function createMockDefaultRoute(): EndpointRoute {
    return {
        version: undefined,
        key: `GET:/test`,
        pathPattern: '/test',
        method: 'GET',
        absPathPattern: '/test',
    } as any;
}

describe('ApiVersion class', () => {
    describe('constructor', () => {
        test('parses exact version with = prefix', () => {
            const apiVersion = new ApiVersion('=20240301');
            expect(apiVersion.version).toBe(20240301);
            expect(apiVersion.exact).toBe(true);
        });

        test('parses range version without prefix', () => {
            const apiVersion = new ApiVersion('20240301');
            expect(apiVersion.version).toBe(20240301);
            expect(apiVersion.exact).toBe(false);
        });

        test('throws error for invalid version number', () => {
            expect(() => new ApiVersion('invalid')).toThrow('Invalid version specification: invalid');
            expect(() => new ApiVersion('abc123')).toThrow('Invalid version specification: abc123');
        });

        test('throws error for zero version', () => {
            expect(() => new ApiVersion('0')).toThrow('Invalid version specification: 0');
        });

        test('throws error for negative version', () => {
            expect(() => new ApiVersion('-20240301')).toThrow('Invalid version specification: -20240301');
        });

        test('throws error for exact zero version', () => {
            expect(() => new ApiVersion('=0')).toThrow('Invalid version specification: =0');
        });
    });

    describe('match method', () => {
        let defaultRoute: EndpointRoute;
        let versions: EndpointVersions;

        beforeEach(() => {
            defaultRoute = createMockDefaultRoute();
            versions = new EndpointVersions();
        });

        describe('exact matching', () => {
            test('returns exact match when found', () => {
                const route1 = createMockRoute(20240201);
                const route2 = createMockRoute(20240301);
                versions.add(route1);
                versions.add(route2);

                const apiVersion = new ApiVersion('=20240301');
                const result = apiVersion.match(defaultRoute, versions);

                expect(result).toBe(route2);
            });

            test('returns undefined when exact match not found', () => {
                const route1 = createMockRoute(20240201);
                versions.add(route1);

                const apiVersion = new ApiVersion('=20240301');
                const result = apiVersion.match(defaultRoute, versions);

                expect(result).toBeUndefined();
            });

            test('returns undefined for exact match from empty versions', () => {
                const apiVersion = new ApiVersion('=20240301');
                const result = apiVersion.match(defaultRoute, versions);

                expect(result).toBeUndefined();
            });
        });

        describe('range matching', () => {
            test('returns latest version before requested version', () => {
                const route1 = createMockRoute(20240201);
                const route2 = createMockRoute(20240301);
                const route3 = createMockRoute(20240401);
                versions.add(route1);
                versions.add(route2);
                versions.add(route3);

                const apiVersion = new ApiVersion('20240315');
                const result = apiVersion.match(defaultRoute, versions);

                expect(result).toBe(route2);
            });

            test('returns exact match when version exists', () => {
                const route1 = createMockRoute(20240201);
                const route2 = createMockRoute(20240301);
                versions.add(route1);
                versions.add(route2);

                const apiVersion = new ApiVersion('20240301');
                const result = apiVersion.match(defaultRoute, versions);

                expect(result).toBe(route2);
            });

            test('returns default route when no version matches', () => {
                const route1 = createMockRoute(20240201);
                const route2 = createMockRoute(20240301);
                versions.add(route1);
                versions.add(route2);

                const apiVersion = new ApiVersion('20240101');
                const result = apiVersion.match(defaultRoute, versions);

                expect(result).toBe(defaultRoute);
            });

            test('returns default route when versions is empty', () => {
                const apiVersion = new ApiVersion('20240301');
                const result = apiVersion.match(defaultRoute, versions);

                expect(result).toBe(defaultRoute);
            });
        });
    });
});

describe('EndpointVersions class', () => {
    let versions: EndpointVersions;

    beforeEach(() => {
        versions = new EndpointVersions();
    });

    describe('add and length', () => {
        test('adds routes and tracks length', () => {
            expect(versions.length).toBe(0);

            versions.add(createMockRoute(20240201));
            expect(versions.length).toBe(1);

            versions.add(createMockRoute(20240301));
            expect(versions.length).toBe(2);
        });
    });

    describe('sorting behavior', () => {
        test('sorts routes by version in ascending order', () => {
            const route3 = createMockRoute(20240301);
            const route1 = createMockRoute(20240101);
            const route2 = createMockRoute(20240201);

            versions.add(route3);
            versions.add(route1);
            versions.add(route2);

            // Force sorting by calling find
            versions.find(20240301);

            // Check if internal array is sorted (we need to access private property for testing)
            const result = versions.findLastVersionBefore(20240301);
            expect(result).toBe(route3);
        });
    });

    describe('linear search (< 16 versions)', () => {
        beforeEach(() => {
            // Add 10 routes to stay under threshold
            for (let i = 1; i <= 10; i++) {
                versions.add(createMockRoute(20240000 + i * 100));
            }
        });

        test('finds exact version', () => {
            const result = versions.find(20240500);
            expect(result?.version).toBe(20240500);
        });

        test('returns undefined when version not found', () => {
            const result = versions.find(20240550);
            expect(result).toBeUndefined();
        });

        test('finds last version before target', () => {
            const result = versions.findLastVersionBefore(20240550);
            expect(result?.version).toBe(20240500);
        });

        test('returns undefined when no version before target', () => {
            const result = versions.findLastVersionBefore(20240050);
            expect(result).toBeUndefined();
        });

        test('finds exact match as last version before', () => {
            const result = versions.findLastVersionBefore(20240500);
            expect(result?.version).toBe(20240500);
        });
    });

    describe('binary search (>= 16 versions)', () => {
        beforeEach(() => {
            // Add 20 routes to trigger binary search
            for (let i = 1; i <= 20; i++) {
                versions.add(createMockRoute(20240000 + i * 100));
            }
        });

        test('finds exact version with binary search', () => {
            const result = versions.find(20241000);
            expect(result?.version).toBe(20241000);
        });

        test('returns undefined when version not found with binary search', () => {
            const result = versions.find(20240550);
            expect(result).toBeUndefined();
        });

        test('finds last version before target with binary search', () => {
            const result = versions.findLastVersionBefore(20240550);
            expect(result?.version).toBe(20240500);
        });

        test('returns undefined when no version before target with binary search', () => {
            const result = versions.findLastVersionBefore(20240050);
            expect(result).toBeUndefined();
        });

        test('finds exact match as last version before with binary search', () => {
            const result = versions.findLastVersionBefore(20241000);
            expect(result?.version).toBe(20241000);
        });

        test('binary search handles edge cases', () => {
            // Test first element
            const first = versions.findLastVersionBefore(20240100);
            expect(first?.version).toBe(20240100);

            // Test last element
            const last = versions.findLastVersionBefore(20242000);
            expect(last?.version).toBe(20242000);

            // Test beyond last element
            const beyond = versions.findLastVersionBefore(20249999);
            expect(beyond?.version).toBe(20242000);
        });
    });

    describe('threshold boundary testing', () => {
        test('uses linear search with exactly 15 versions', () => {
            // Add exactly 15 routes
            for (let i = 1; i <= 15; i++) {
                versions.add(createMockRoute(20240000 + i * 100));
            }

            const result = versions.find(20240500);
            expect(result?.version).toBe(20240500);
        });

        test('uses binary search with exactly 16 versions', () => {
            // Add exactly 16 routes
            for (let i = 1; i <= 16; i++) {
                versions.add(createMockRoute(20240000 + i * 100));
            }

            const result = versions.find(20240500);
            expect(result?.version).toBe(20240500);
        });
    });

    describe('unsorted behavior', () => {
        test('automatically sorts when searching unsorted collection', () => {
            const route3 = createMockRoute(20240301);
            const route1 = createMockRoute(20240101);
            const route2 = createMockRoute(20240201);

            versions.add(route3);
            versions.add(route1);
            versions.add(route2);

            // First search should trigger sorting
            const result = versions.findLastVersionBefore(20240250);
            expect(result?.version).toBe(20240201);
        });

        test('maintains sort after adding new routes', () => {
            versions.add(createMockRoute(20240301));
            versions.add(createMockRoute(20240101));

            // Trigger initial sort
            versions.find(20240301);

            // Add new route (should mark as unsorted)
            versions.add(createMockRoute(20240201));

            // This search should re-sort
            const result = versions.findLastVersionBefore(20240250);
            expect(result?.version).toBe(20240201);
        });
    });

    describe('performance comparison scenarios', () => {
        test('linear search performance with small dataset', () => {
            const routes = [];
            for (let i = 1; i <= 10; i++) {
                const route = createMockRoute(20240000 + i * 100);
                routes.push(route);
                versions.add(route);
            }

            // Multiple searches to test linear search
            expect(versions.find(20240100)?.version).toBe(20240100);
            expect(versions.find(20240500)?.version).toBe(20240500);
            expect(versions.find(20241000)?.version).toBe(20241000);
        });

        test('binary search performance with large dataset', () => {
            const routes = [];
            for (let i = 1; i <= 100; i++) {
                const route = createMockRoute(20240000 + i * 100);
                routes.push(route);
                versions.add(route);
            }

            // Multiple searches to test binary search
            expect(versions.find(20240100)?.version).toBe(20240100);
            expect(versions.find(20245000)?.version).toBe(20245000);
            expect(versions.find(20250000)?.version).toBe(20250000);
        });
    });

    describe('edge case optimizations', () => {
        test('empty array returns undefined immediately without sorting', () => {
            // Test that empty array doesn't call sort unnecessarily
            expect(versions.find(20240301)).toBeUndefined();
            expect(versions.findLastVersionBefore(20240301)).toBeUndefined();
        });

        test('single element array works correctly', () => {
            const route = createMockRoute(20240301);
            versions.add(route);

            expect(versions.find(20240301)).toBe(route);
            expect(versions.find(20240302)).toBeUndefined();
            expect(versions.findLastVersionBefore(20240301)).toBe(route);
            expect(versions.findLastVersionBefore(20240300)).toBeUndefined();
        });

        test('two element array sorts correctly', () => {
            const route2 = createMockRoute(20240301);
            const route1 = createMockRoute(20240201);

            // Add in reverse order to test sorting
            versions.add(route2);
            versions.add(route1);

            expect(versions.findLastVersionBefore(20240250)).toBe(route1);
            expect(versions.findLastVersionBefore(20240301)).toBe(route2);
        });
    });
});
