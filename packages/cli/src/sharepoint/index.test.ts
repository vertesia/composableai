import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSharePointCommand } from './index.js';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
}));

vi.mock('../client.js', () => ({
    getClient: async () => ({
        sharePointSources: { list: mocks.list, retrieve: mocks.retrieve, create: mocks.create, delete: mocks.delete },
        workflows: { execute: mocks.execute },
    }),
}));

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

const SOURCE = {
    id: 'src-1',
    name: 'legal',
    oauth_provider_id: 'oauth-1',
    site_url: 'https://contoso.sharepoint.com/sites/legal',
    site_id: 'site-1',
    drive_id: 'drive-1',
    library_name: 'Documents',
    folder_path: 'Contracts',
    folder_item_id: 'folder-1',
    location_root: '/sharepoint/legal',
};

async function run(...args: string[]) {
    const program = new Command();
    program.exitOverride();
    registerSharePointCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await program.parseAsync(['sharepoint', ...args], { from: 'user' });
}

describe('sharepoint CLI', () => {
    it('creates a source from options', async () => {
        mocks.create.mockResolvedValue(SOURCE);
        await run(
            'create',
            '--name',
            'legal',
            '--oauth-provider',
            'oauth-1',
            '--site-url',
            'https://contoso.sharepoint.com/sites/legal',
            '--folder',
            'Contracts',
        );
        expect(mocks.create).toHaveBeenCalledWith({
            name: 'legal',
            oauth_provider_id: 'oauth-1',
            site_url: 'https://contoso.sharepoint.com/sites/legal',
            folder_path: 'Contracts',
        });
    });

    it('starts bulkImportWorkflow with the source vars', async () => {
        mocks.retrieve.mockResolvedValue(SOURCE);
        mocks.execute.mockResolvedValue([{ workflow_id: 'wf-1', run_id: 'run-1' }]);

        await run('import', 'src-1', '--queue', 'zeno-content/dev/bulk', '--batch-size', '100', '--dry-run');

        expect(mocks.execute).toHaveBeenCalledWith('bulkImportWorkflow', {
            vars: { source: { type: 'sharepoint', source_id: 'src-1' }, batchSize: 100, dryRun: true },
            task_queue: 'zeno-content/dev/bulk',
        });
    });

    it('rejects an invalid batch size before starting anything', async () => {
        mocks.retrieve.mockResolvedValue(SOURCE);
        await expect(run('import', 'src-1', '--batch-size', '5000')).rejects.toThrow('Invalid batch size');
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('fails when the workflow does not start', async () => {
        mocks.retrieve.mockResolvedValue(SOURCE);
        mocks.execute.mockResolvedValue([undefined]);
        await expect(run('import', 'src-1')).rejects.toThrow('did not start');
    });

    it('prints one line per source, or JSON with --json', async () => {
        mocks.list.mockResolvedValue([SOURCE]);
        await run('list');
        expect(vi.mocked(console.log).mock.calls[0][0]).toContain('src-1  legal');

        vi.mocked(console.log).mockClear();
        await run('list', '--json');
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual([SOURCE]);
    });
});
