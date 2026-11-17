import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildCreateDataStorePayload,
    buildImportMessage,
    buildImportUploadPath,
    buildUpdateDataStorePayload,
    importVersionChoice,
    withoutUrlSecrets,
} from './commands.js';

describe('data write versioning options', () => {
    it('sends the versioning of a new store only when it is named', () => {
        expect(buildCreateDataStorePayload('sales', {})).not.toHaveProperty('versioning');
        expect(buildCreateDataStorePayload('sales', { dataWrites: 'skip' }).versioning).toEqual({
            data_writes: 'skip',
        });
        expect(() => buildCreateDataStorePayload('sales', { dataWrites: 'never' })).toThrow(/keep or skip/);
    });

    it('updates the settings it is given, and refuses an update that names none', () => {
        expect(buildUpdateDataStorePayload({ dataWrites: 'keep' })).toEqual({ versioning: { data_writes: 'keep' } });
        expect(() => buildUpdateDataStorePayload({})).toThrow(/Nothing to update/);
    });

    it('leaves the choice of an import to the store unless a flag makes it', () => {
        expect(importVersionChoice({})).toBeUndefined();
        expect(importVersionChoice({ keepVersion: true })).toBe(true);
        expect(importVersionChoice({ skipVersion: true })).toBe(false);
        expect(() => importVersionChoice({ keepVersion: true, skipVersion: true })).toThrow(/not both/);
    });
});

describe('buildImportMessage', () => {
    it('names the source by the label it is given', () => {
        expect(buildImportMessage('events', 'events-06.parquet', undefined)).toBe(
            'Import events-06.parquet into events via vertesia CLI',
        );
    });

    it('keeps the message the caller wrote, trimmed', () => {
        expect(buildImportMessage('events', 'events-06.parquet', '  nightly load ')).toBe('nightly load');
    });

    it('ignores a blank message', () => {
        expect(buildImportMessage('events', 'events-06.parquet', '   ')).toBe(
            'Import events-06.parquet into events via vertesia CLI',
        );
    });
});

describe('withoutUrlSecrets', () => {
    it('drops the query and fragment, where a signed URL carries its token', () => {
        expect(
            withoutUrlSecrets('https://bucket.example.com/data/orders.csv?X-Goog-Signature=abc&expires=1#part'),
        ).toBe('https://bucket.example.com/data/orders.csv');
    });

    it('drops user information', () => {
        expect(withoutUrlSecrets('https://user:secret@files.example.com/orders.csv')).toBe(
            'https://files.example.com/orders.csv',
        );
    });

    it('keeps a URL that carries none of them', () => {
        expect(withoutUrlSecrets('http://files.example.com/orders.csv')).toBe('http://files.example.com/orders.csv');
    });

    it('drops the same parts from a URL the runtime cannot parse', () => {
        expect(withoutUrlSecrets('https://user:secret@bad host/orders.csv?token=abc')).toBe(
            'https://bad host/orders.csv',
        );
    });
});

const RUN_VARIABLES = ['VERTESIA_ARTIFACT_STORAGE_ID', 'VERTESIA_AGENTRUN_ID', 'VERTESIA_RUN_ID'];

describe('buildImportUploadPath', () => {
    beforeEach(() => {
        for (const name of RUN_VARIABLES) vi.stubEnv(name, '');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('stages a file under the store when there is no agent run', () => {
        expect(buildImportUploadPath('orders.parquet', 'store-1', {})).toMatch(
            /^imports\/data-stores\/store-1\/\d+-[0-9a-f-]{36}-orders\.parquet$/,
        );
    });

    it('stages a file under the artifact storage of an agent run', () => {
        vi.stubEnv('VERTESIA_AGENTRUN_ID', 'run-9');
        expect(buildImportUploadPath('orders.parquet', 'store-1', {})).toMatch(
            /^imports\/run-9\/\d+-.+-orders\.parquet$/,
        );
    });

    it('uses an explicit prefix without its leading and trailing slashes', () => {
        vi.stubEnv('VERTESIA_AGENTRUN_ID', 'run-9');
        expect(buildImportUploadPath('orders.parquet', 'store-1', { prefix: '/staging/big/' })).toMatch(
            /^staging\/big\/\d+-.+-orders\.parquet$/,
        );
    });
});

describe('buildCreateDataStorePayload', () => {
    it('sends the name alone by default, so the server picks the format', () => {
        expect(buildCreateDataStorePayload('sales', {})).toEqual({ name: 'sales' });
    });

    it('sends the description, tags and storage format it is given', () => {
        expect(
            buildCreateDataStorePayload('sales', {
                description: 'Orders',
                tag: ['finance', 'eu'],
                storageFormat: 'ducklake',
            }),
        ).toEqual({ name: 'sales', description: 'Orders', tags: ['finance', 'eu'], storage_format: 'ducklake' });
    });

    it('refuses a storage format the API does not name', () => {
        expect(() => buildCreateDataStorePayload('sales', { storageFormat: 'iceberg' })).toThrow(
            "Invalid --storage-format 'iceberg': use duckdb or ducklake",
        );
    });
});
