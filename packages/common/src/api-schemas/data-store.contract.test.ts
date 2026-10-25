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

    it('accepts a recoverable import ID at the HTTP request boundary', () => {
        const input = { mode: 'append', message: 'Import rows', tables: {}, import_id: '6aa400001234567890abcdef' };
        expect(validateApiRequest('ImportDataPayload', input).valid).toBe(true);
        expect(validateApiRequest('ImportDataPayload', { ...input, import_id: 'invalid' }).valid).toBe(false);
    });

    it('rejects undeclared request fields through the published component', () => {
        expect(
            validateApiRequest('CreateDataStorePayload', {
                name: 'analytics',
                project: 'ignored-by-the-old-handler',
            }).valid,
        ).toBe(false);
    });

    it.each([
        'customer_analytics',
        'Sales DB 2026',
        'e2e-test-store-1792345678901-0123456789abcdef0123456789abcdef',
        'a',
        'v1.2',
        'données clients',
        '売上',
        'x'.repeat(128),
    ])('accepts the store name %j', (name) => {
        expect(validateApiRequest('CreateDataStorePayload', { name }).valid).toBe(true);
    });

    it.each([
        ['empty', ''],
        ['too long', 'x'.repeat(129)],
        ['a parent segment', '..'],
        ['a current segment', '.'],
        ['a traversal', '../zap-probe-traversal'],
        ['a slash', 'team/sales'],
        ['a backslash', 'team\\sales'],
        ['a leading dot', '.hidden'],
        ['a leading space', ' sales'],
        ['a trailing space', 'sales '],
        ['a NUL', 'sales\u0000'],
        ['a newline', 'sales\nreport'],
        ['a tab', 'sales\treport'],
        ['DEL', 'sales\u007f'],
        ['a C1 control', 'sales\u0085'],
    ])('rejects a store name with %s', (_case, name) => {
        expect(validateApiRequest('CreateDataStorePayload', { name }).valid).toBe(false);
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

    it('accepts foreign keys added to and dropped from an existing table', () => {
        expect(
            validateApiRequest('AlterTablePayload', {
                changes: [
                    {
                        op: 'add_foreign_key',
                        foreign_key: { column: 'customer_id', references_table: 'customers', references_column: 'id' },
                    },
                    { op: 'drop_foreign_key', column: 'product_id' },
                ],
            }).valid,
        ).toBe(true);

        expect(
            validateApiRequest('AlterTablePayload', {
                changes: [{ op: 'add_foreign_key', foreign_key: { column: 'customer_id' } }],
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
