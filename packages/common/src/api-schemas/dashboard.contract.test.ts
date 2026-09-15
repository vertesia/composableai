import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type {
    CreateDashboardPayload,
    Dashboard,
    DashboardDataSource,
    DashboardItem,
    DashboardStatus,
    DashboardVersion,
    UpdateDashboardPayload,
} from '../data-platform.js';
import type {
    CreateDashboardPayloadSchema,
    DashboardDataSourceSchema,
    DashboardItemSchema,
    DashboardSchema,
    DashboardStatusSchema,
    DashboardVersionSchema,
    UpdateDashboardPayloadSchema,
} from './dashboard.js';
import { ApiSchemaComponents, validateApiRequest, validateApiResponse } from './registry.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

describe('the dashboard public types', () => {
    it('derive from the runtime schemas instead of restating them', () => {
        assertType<Equals<DashboardStatus, z.infer<typeof DashboardStatusSchema>>>(true);
        assertType<Equals<DashboardDataSource, z.infer<typeof DashboardDataSourceSchema>>>(true);
        assertType<Equals<DashboardItem, z.infer<typeof DashboardItemSchema>>>(true);
        assertType<Equals<Dashboard, z.infer<typeof DashboardSchema>>>(true);
        assertType<Equals<DashboardVersion, z.infer<typeof DashboardVersionSchema>>>(true);
        assertType<Equals<CreateDashboardPayload, z.infer<typeof CreateDashboardPayloadSchema>>>(true);
        assertType<Equals<UpdateDashboardPayload, z.infer<typeof UpdateDashboardPayloadSchema>>>(true);
    });

    it('keeps the runtime status values available without importing Zod from the root entry', async () => {
        const common = await import('../data-platform.js');
        expect(common.DashboardStatus).toEqual({ ACTIVE: 'active', ARCHIVED: 'archived' });
    });
});

describe('dashboard request validation', () => {
    const create = {
        name: 'Revenue',
        dataSource: { kind: 'data_sql', query: 'select * from revenue' },
        spec: { mark: 'bar' },
    };

    it('accepts the two documented data-source branches', () => {
        expect(validateApiRequest('CreateDashboardPayload', create)).toMatchObject({ valid: true });
        expect(
            validateApiRequest('CreateDashboardPayload', {
                ...create,
                dataSource: { kind: 'store_es_dsl', dsl: { size: 20 }, result: { type: 'hits' } },
            }),
        ).toMatchObject({ valid: true });
    });

    it('rejects an unknown data-source discriminator and undeclared payload fields', () => {
        expect(
            validateApiRequest('CreateDashboardPayload', {
                ...create,
                dataSource: { kind: 'http', url: 'https://example.test/data' },
            }).valid,
        ).toBe(false);
        expect(validateApiRequest('CreateDashboardPayload', { ...create, project: 'ignored-before' }).valid).toBe(
            false,
        );
    });

    it('accepts legacy updates without a revision while rejecting undeclared fields', () => {
        expect(validateApiRequest('UpdateDashboardPayload', {}).valid).toBe(true);
        expect(validateApiRequest('UpdateDashboardPayload', { summary: 'Legacy update' }).valid).toBe(true);
        expect(
            validateApiRequest('UpdateDashboardPayload', {
                expected_edit_revision: 1,
                spec: { mark: 'line' },
            }),
        ).toMatchObject({
            valid: true,
        });
        expect(
            validateApiRequest('UpdateDashboardPayload', { expected_edit_revision: 1, skip_versioning: true }),
        ).toMatchObject({ valid: true });
        expect(validateApiRequest('UpdateDashboardPayload', { expected_edit_revision: 1, unknown: true }).valid).toBe(
            false,
        );
    });

    it('keeps the two bulk bodies as the free-form string-array map already published', () => {
        expect(validateApiRequest('StringArrayMap', { ids: ['one', 'two'] })).toMatchObject({ valid: true });
        expect(validateApiRequest('StringArrayMap', { labels: ['one'] })).toMatchObject({ valid: true });
        expect(validateApiRequest('StringArrayMap', { ids: 'one' }).valid).toBe(false);
    });
});

describe('dashboard response validation', () => {
    const item = {
        id: 'dashboard-1',
        edit_revision: 1,
        name: 'Revenue',
        tags: [],
        updated_by: 'user:editor',
        created_by: 'user:author',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
        store_id: 'store-1',
        status: 'active',
        panel_count: 0,
        query_count: 0,
    };

    it('accepts the mapper-produced listing and full response shapes', () => {
        expect(validateApiResponse('DashboardItem', item)).toMatchObject({ valid: true });
        expect(
            validateApiResponse('Dashboard', {
                ...item,
                query: 'select * from revenue',
                spec: { mark: 'bar' },
                queries: [],
                panels: [],
                layout: { columns: 2, cellWidth: 600, cellHeight: 400, padding: 20 },
            }),
        ).toMatchObject({ valid: true });
    });

    it('rejects persistence-only fields instead of allowing a document spread to escape', () => {
        expect(validateApiResponse('DashboardItem', { ...item, account: 'account-1' }).valid).toBe(false);
    });

    it('registers the complete response closure used by the endpoints', () => {
        expect(ApiSchemaComponents).toHaveProperty('DashboardItemArray');
        expect(ApiSchemaComponents).toHaveProperty('DashboardVersionItemArray');
        expect(ApiSchemaComponents).toHaveProperty('DashboardVersion');
        expect(ApiSchemaComponents).toHaveProperty('Dashboard');
    });
});
