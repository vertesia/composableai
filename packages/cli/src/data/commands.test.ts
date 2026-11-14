import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildImportUploadPath } from './commands.js';

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
