import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
    AlterTableOperation,
    DataStore,
    DataStoreSchemaResponse,
    ImportJob,
    ListDataStoreVersionsQuery,
} from '../data-platform.js';
import type {
    AlterTableOperationSchema,
    DataStoreSchema,
    DataStoreSchemaResponseSchema,
    ImportJobSchema,
    ListDataStoreVersionsQuerySchema,
} from './data-store.js';
import { ApiSchemaComponents, validateApiRequest, validateApiResponse } from './registry.js';

describe('data-store API contracts', () => {
    it('derives the public types from the runtime schemas', () => {
        expectTypeOf<DataStore>().toEqualTypeOf<import('zod').z.infer<typeof DataStoreSchema>>();
        expectTypeOf<ImportJob>().toEqualTypeOf<import('zod').z.infer<typeof ImportJobSchema>>();
        expectTypeOf<AlterTableOperation>().toEqualTypeOf<import('zod').z.infer<typeof AlterTableOperationSchema>>();
        expectTypeOf<DataStoreSchemaResponse>().toEqualTypeOf<
            import('zod').z.infer<typeof DataStoreSchemaResponseSchema>
        >();
        expectTypeOf<ListDataStoreVersionsQuery>().toEqualTypeOf<
            import('zod').z.infer<typeof ListDataStoreVersionsQuerySchema>
        >();
    });

    it('rejects undeclared request fields through the published component', () => {
        expect(
            validateApiRequest('CreateDataStorePayload', {
                name: 'analytics',
                project: 'ignored-by-the-old-handler',
            }).valid,
        ).toBe(false);
    });

    it('enforces every alter-table discriminator branch', () => {
        expect(
            validateApiRequest('AlterTablePayload', {
                changes: [{ op: 'rename_column', from: 'old_name', to: 'new_name' }],
            }).valid,
        ).toBe(true);

        expect(
            validateApiRequest('AlterTablePayload', {
                changes: [{ op: 'rename_column', from: 'old_name', column: 'new_name' }],
            }).valid,
        ).toBe(false);
    });

    it('keeps free-form row and parameter maps open', () => {
        expect(
            validateApiRequest('QueryPayload', {
                sql: 'SELECT * FROM users WHERE tenant = $tenant',
                params: { tenant: 'project-1', include_archived: false },
            }).valid,
        ).toBe(true);
    });

    it('requires the renamed store_id field on import-job responses', () => {
        const response: ImportJob = {
            id: 'job-1',
            store_id: 'store-1',
            status: 'completed',
            tables: ['users'],
            mode: 'append',
            rows_imported: 2,
            started_at: '2026-08-02T00:00:00.000Z',
        };
        expect(validateApiResponse('ImportJob', response).valid).toBe(true);
        expect(validateApiResponse('ImportJob', { ...response, store_id: undefined }).valid).toBe(false);
    });

    it('registers the entire data-store reference closure', () => {
        for (const name of [
            'DataStore',
            'DataSchema',
            'DataTable',
            'DataColumn',
            'DataStoreSchemaResponse',
            'DataSchemaForAI',
            'ListDataStoreVersionsQuery',
            'GetDataStoreTableQuery',
        ]) {
            expect(ApiSchemaComponents[name]).toBeDefined();
        }
    });
});
