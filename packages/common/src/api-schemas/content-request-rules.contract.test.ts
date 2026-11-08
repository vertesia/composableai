import { describe, expect, it } from 'vitest';
import { validateApiRequest } from './registry.js';

/**
 * Request rules of the content and collection components that the server checks itself before using a value. Each
 * rule is published so that a request the contract accepts is one the server can run.
 */

const OBJECT_ID = '6aefdc6b3db5a49d7587027d';
const RUN_ID = '0193a3f2-6c1e-7b8a-9d4e-2f1a3b5c7d9e';

describe('collection membership payloads', () => {
    it('accept ObjectIds and refuse any other member or child ID', () => {
        expect(
            validateApiRequest('CollectionMembersUpdatePayload', { action: 'add', members: [OBJECT_ID] }).valid,
        ).toBe(true);
        expect(validateApiRequest('CollectionMembersUpdatePayload', { action: 'add', members: [''] }).valid).toBe(
            false,
        );
        expect(
            validateApiRequest('CollectionChildrenUpdatePayload', { action: 'add', children: [OBJECT_ID] }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('CollectionChildrenUpdatePayload', { action: 'delete', children: ['not-an-id'] }).valid,
        ).toBe(false);
    });

    it('filter members by a stored type ID or by nothing', () => {
        expect(validateApiRequest('CollectionMembersQuery', { type: OBJECT_ID }).valid).toBe(true);
        expect(validateApiRequest('CollectionMembersQuery', { type: '' }).valid).toBe(true);
        expect(validateApiRequest('CollectionMembersQuery', { type: 'ExecuteConversationWorkflow' }).valid).toBe(false);
    });
});

describe('collection payloads', () => {
    it('search the children of a collection named by its ObjectId, or of none', () => {
        for (const parent of [OBJECT_ID, '', null]) {
            expect(validateApiRequest('ComplexCollectionSearchQuery', { parent }).valid).toBe(true);
        }
        expect(validateApiRequest('ComplexCollectionSearchQuery', { parent: ')' }).valid).toBe(false);
    });

    it('refuse an empty name on update', () => {
        expect(validateApiRequest('UpdateCollectionPayload', { description: 'x' }).valid).toBe(true);
        expect(validateApiRequest('UpdateCollectionPayload', { name: '' }).valid).toBe(false);
    });

    it('accept only the three content permissions and well-formed principals', () => {
        const valid = {
            'content:read': ['project:*'],
            'content:write': [`user:${OBJECT_ID}`, `GROUP:${OBJECT_ID.toUpperCase()}`],
            'content:delete': [`role:${OBJECT_ID}`],
        };
        expect(validateApiRequest('CollectionPermissionsPayload', valid).valid).toBe(true);
        expect(validateApiRequest('CollectionPermissionsPayload', {}).valid).toBe(true);
        expect(validateApiRequest('CollectionPermissionsPayload', { 'x-additional': [] }).valid).toBe(false);
        expect(validateApiRequest('CollectionPermissionsPayload', { 'content:read': ['user:me'] }).valid).toBe(false);
        expect(validateApiRequest('CollectionPermissionsPayload', { 'content:read': ['project:all'] }).valid).toBe(
            false,
        );
    });
});

describe('content object payloads', () => {
    it('require the MIME type of a content source', () => {
        const withType = { content: { source: 'gs://bucket/file.pdf', type: 'application/pdf' } };
        expect(validateApiRequest('CreateContentObjectPayload', withType).valid).toBe(true);
        expect(validateApiRequest('CreateContentObjectPayload', { content: { source: '0' } }).valid).toBe(false);
        expect(
            validateApiRequest('CreateContentObjectPayload', { name: 'n', content: { source: '0', type: '' } }).valid,
        ).toBe(false);
        // Without a source there is no file, so no MIME type to require.
        expect(validateApiRequest('CreateContentObjectPayload', { name: 'n', content: { etag: 'e' } }).valid).toBe(
            true,
        );
    });

    it('take a content source only as a cloud blob URI', () => {
        const source = (value: string) => ({ name: 'n', content: { source: value, type: 'application/pdf' } });
        for (const uri of ['gs://bucket/a.pdf', 's3://bucket/a.pdf', 'az://container/a.pdf']) {
            expect(validateApiRequest('CreateContentObjectPayload', source(uri)).valid).toBe(true);
            expect(validateApiRequest('UpdateContentObjectPayload', source(uri)).valid).toBe(true);
        }
        for (const uri of ['0', 'bucket/a.pdf', 'https://example.com/a.pdf']) {
            expect(validateApiRequest('CreateContentObjectPayload', source(uri)).valid).toBe(false);
            expect(validateApiRequest('UpdateContentObjectPayload', source(uri)).valid).toBe(false);
        }
        // The server skips an empty source, and an update opens a source only when it has a MIME type.
        expect(validateApiRequest('UpdateContentObjectPayload', { content: { source: '' } }).valid).toBe(true);
        expect(validateApiRequest('UpdateContentObjectPayload', { content: { source: 'gs://b/a.pdf' } }).valid).toBe(
            false,
        );
    });

    it('name a parent object by its ObjectId', () => {
        for (const name of ['CreateContentObjectPayload', 'UpdateContentObjectPayload'] as const) {
            expect(validateApiRequest(name, { name: 'n', parent: OBJECT_ID }).valid).toBe(true);
            expect(validateApiRequest(name, { name: 'n', parent: '' }).valid).toBe(false);
        }
    });

    it('export only columns whose field is a plain path, unless they link the object', () => {
        const layout = (column: Record<string, string>) => ({
            objectIds: [],
            type: 'CSV',
            table_layout: [{ name: 'Column', ...column }],
        });
        expect(validateApiRequest('ExportPropertiesPayload', layout({ field: 'properties.title' })).valid).toBe(true);
        expect(validateApiRequest('ExportPropertiesPayload', layout({ field: 'files.0.name' })).valid).toBe(true);
        for (const field of ['', '$$ROOT', 'properties..title']) {
            expect(validateApiRequest('ExportPropertiesPayload', layout({ field })).valid).toBe(false);
        }
        expect(validateApiRequest('ExportPropertiesPayload', layout({ field: '', type: 'objectLink' })).valid).toBe(
            true,
        );
    });

    it('refuse inherited property metadata without a name or collection', () => {
        const inherited = (name: string, collection: string) => ({
            name: 'n',
            inherited_properties: [{ name, collection }],
        });
        expect(validateApiRequest('CreateContentObjectPayload', inherited('title', OBJECT_ID)).valid).toBe(true);
        expect(validateApiRequest('CreateContentObjectPayload', inherited('', '')).valid).toBe(false);
    });

    it('export properties only as JSON or CSV', () => {
        expect(validateApiRequest('ExportPropertiesPayload', { objectIds: [], type: 'CSV' }).valid).toBe(true);
        expect(validateApiRequest('ExportPropertiesPayload', { objectIds: [], type: '' }).valid).toBe(false);
        expect(
            validateApiRequest('ExportPropertiesPayload', { objectIds: [], type: 'contentObjectExportWorkflow' }).valid,
        ).toBe(false);
    });

    it('bulk-export only types the server can name', () => {
        const filter = (types: string[]) => ({ filter: { types } });
        expect(
            validateApiRequest('StartContentObjectExportRequest', filter(['Document', OBJECT_ID, 'sys:Document']))
                .valid,
        ).toBe(true);
        expect(validateApiRequest('StartContentObjectExportRequest', filter([''])).valid).toBe(false);
        expect(validateApiRequest('StartContentObjectExportRequest', filter(['Invoice'])).valid).toBe(false);
    });

    it('name an export workflow run by its UUID', () => {
        expect(validateApiRequest('ContentObjectExportPathParams', { runId: RUN_ID }).valid).toBe(true);
        expect(validateApiRequest('ContentObjectExportPathParams', { runId: '0' }).valid).toBe(false);
    });
});
