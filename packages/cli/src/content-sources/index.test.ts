import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerContentSourcesCommand } from './index.js';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    sync: vi.fn(),
    status: vi.fn(),
    report: vi.fn(),
}));

vi.mock('../client.js', () => ({
    getClient: async () => ({ contentSources: mocks }),
}));

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

const SHAREPOINT = {
    id: 'src-1',
    type: 'sharepoint',
    name: 'legal',
    oauth_provider_id: 'oauth-1',
    site_url: 'https://contoso.sharepoint.com/sites/legal',
    site_id: 'site-1',
    drive_id: 'drive-1',
    library_name: 'Documents',
    folder_path: 'Contracts',
    folder_item_id: 'folder-1',
    location_root: '/sharepoint/legal',
    sync: { enabled: false, interval_minutes: 60 },
};

const BOX = {
    id: 'src-2',
    type: 'box',
    name: 'finance',
    oauth_provider_id: 'oauth-2',
    folder_id: '123',
    folder_name: 'Finance',
    folder_path: 'All Files/Finance',
    location_root: '/box/finance',
    sync: { enabled: true, interval_minutes: 30 },
};

const STATUS = {
    state: 'waiting',
    last_round: {
        kind: 'import',
        started_at: '2026-11-11T10:00:00.000Z',
        finished_at: '2026-11-11T10:05:00.000Z',
        counts: { listed: 4, created: 3, updated: 0, unchanged: 0, deleted: 1, skipped: 1, failed: 0 },
        swept: true,
    },
    next_sync_at: '2026-11-11T10:35:00.000Z',
};

async function run(...args: string[]) {
    const program = new Command();
    program.exitOverride();
    registerContentSourcesCommand(program);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await program.parseAsync(['content-sources', ...args], { from: 'user' });
    return log.mock.calls.map((call) => String(call[0])).join('\n');
}

describe('content-sources CLI', () => {
    it('creates a SharePoint source from options', async () => {
        mocks.create.mockResolvedValue(SHAREPOINT);
        const output = await run(
            'create',
            '--type',
            'sharepoint',
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
            type: 'sharepoint',
            name: 'legal',
            oauth_provider_id: 'oauth-1',
            site_url: 'https://contoso.sharepoint.com/sites/legal',
            folder_path: 'Contracts',
        });
        expect(output).toContain('Created src-1  legal  [sharepoint]');
        expect(output).toContain('manual');
    });

    it('creates a Box source with a schedule', async () => {
        mocks.create.mockResolvedValue(BOX);
        const output = await run(
            'create',
            '--type',
            'box',
            '--name',
            'finance',
            '--oauth-provider',
            'oauth-2',
            '--folder-id',
            '123',
            '--interval',
            '30',
        );
        expect(mocks.create).toHaveBeenCalledWith({
            type: 'box',
            name: 'finance',
            oauth_provider_id: 'oauth-2',
            folder_id: '123',
            sync: { enabled: true, interval_minutes: 30 },
        });
        expect(output).toContain('every 30 min');
    });

    it('refuses an unknown type and missing type-specific options', async () => {
        await expect(run('create', '--type', 'dropbox', '--name', 'x', '--oauth-provider', 'o')).rejects.toThrow(
            'Invalid type',
        );
        await expect(run('create', '--type', 'box', '--name', 'x', '--oauth-provider', 'o')).rejects.toThrow(
            '--folder-id',
        );
        await expect(run('create', '--type', 'sharepoint', '--name', 'x', '--oauth-provider', 'o')).rejects.toThrow(
            '--site-url',
        );
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('updates the schedule, keeping the current interval', async () => {
        mocks.retrieve.mockResolvedValue(BOX);
        mocks.update.mockResolvedValue({ ...BOX, sync: { enabled: false, interval_minutes: 30 } });
        await run('update', 'src-2', '--no-schedule');
        expect(mocks.update).toHaveBeenCalledWith('src-2', { sync: { enabled: false, interval_minutes: 30 } });
    });

    it('renames without reading the source', async () => {
        mocks.update.mockResolvedValue(SHAREPOINT);
        await run('update', 'src-1', '--name', 'legal-2');
        expect(mocks.retrieve).not.toHaveBeenCalled();
        expect(mocks.update).toHaveBeenCalledWith('src-1', { name: 'legal-2' });
    });

    it('lists sources one per line', async () => {
        mocks.list.mockResolvedValue([SHAREPOINT, BOX]);
        const output = await run('list');
        expect(output.split('\n')).toHaveLength(2);
        expect(output).toContain('Box folder 123 (All Files/Finance)');
    });

    it('starts a full sync and prints the status', async () => {
        mocks.sync.mockResolvedValue(STATUS);
        const output = await run('sync', 'src-1', '--full');
        expect(mocks.sync).toHaveBeenCalledWith('src-1', { full: true });
        expect(output).toContain('state: waiting');
        expect(output).toContain('created 3');
        expect(output).toContain('swept');
    });

    it('prints the status as JSON', async () => {
        mocks.status.mockResolvedValue(STATUS);
        const output = await run('status', 'src-1', '--json');
        expect(JSON.parse(output)).toEqual(STATUS);
    });

    it('deletes a source', async () => {
        mocks.delete.mockResolvedValue({ count: 1 });
        await run('delete', 'src-1');
        expect(mocks.delete).toHaveBeenCalledWith('src-1');
    });

    it('prints the skipped reasons and the earlier rounds in the status', async () => {
        mocks.status.mockResolvedValue({
            ...STATUS,
            last_round: { ...STATUS.last_round, id: 'round-2', skipped_by_reason: { package: 1 } },
            recent_rounds: [
                { ...STATUS.last_round, id: 'round-2' },
                { ...STATUS.last_round, id: 'round-1', kind: 'update' },
            ],
        });
        const output = await run('status', 'src-1');
        expect(output).toContain('(round round-2)');
        expect(output).toContain('skipped: package 1');
        expect(output).toContain('round-1');
    });
});

describe('content-sources report', () => {
    const FAILED = { action: 'failed', kind: 'file', item_id: 'f1', name: 'a.pdf', path: 'Docs', error: 'bad name' };
    const CREATED = { action: 'created', kind: 'file', item_id: 'f2', name: 'b.pdf', object_id: 'obj-2' };
    const FOLDER = { action: 'failed', kind: 'folder', item_id: 'd1', name: 'Docs', path: '', error: 'Listing failed' };

    it("reads every page of the last round's report", async () => {
        mocks.status.mockResolvedValue({ ...STATUS, last_round: { ...STATUS.last_round, id: 'round-1' } });
        mocks.report
            .mockResolvedValueOnce({ round_id: 'round-1', entries: [FAILED], next_cursor: 'c1' })
            .mockResolvedValueOnce({ round_id: 'round-1', entries: [CREATED, FOLDER] });

        const output = await run('report', 'src-1');

        expect(mocks.report).toHaveBeenNthCalledWith(1, 'src-1', 'round-1', { limit: 1000 });
        expect(mocks.report).toHaveBeenNthCalledWith(2, 'src-1', 'round-1', { cursor: 'c1', limit: 1000 });
        expect(output.split('\n')).toEqual([
            'round round-1: 3 entries',
            'failed   Docs/a.pdf  (error: bad name)',
            'created  b.pdf  (document obj-2)',
            'failed   folder /  (error: Listing failed)',
        ]);
    });

    it('prefers the round in progress', async () => {
        mocks.status.mockResolvedValue({
            ...STATUS,
            state: 'running',
            current_round: { ...STATUS.last_round, id: 'round-2' },
            last_round: { ...STATUS.last_round, id: 'round-1' },
        });
        mocks.report.mockResolvedValue({ round_id: 'round-2', entries: [] });
        await run('report', 'src-1');
        expect(mocks.report).toHaveBeenCalledWith('src-1', 'round-2', { limit: 1000 });
    });

    it('reads a given round, filtered and limited, as JSON', async () => {
        mocks.report.mockResolvedValue({ round_id: 'round-1', entries: [FAILED, FAILED], next_cursor: 'c1' });

        const output = await run('report', 'src-1', 'round-1', '--action', 'failed', '--limit', '2', '--json');

        expect(mocks.status).not.toHaveBeenCalled();
        expect(mocks.report).toHaveBeenCalledOnce();
        expect(mocks.report).toHaveBeenCalledWith('src-1', 'round-1', { action: 'failed', limit: 2 });
        expect(JSON.parse(output)).toEqual({ round_id: 'round-1', entries: [FAILED, FAILED], truncated: true });
    });

    it('refuses an unknown action or limit before calling the server', async () => {
        await expect(run('report', 'src-1', 'round-1', '--action', 'renamed')).rejects.toThrow('Invalid action');
        await expect(run('report', 'src-1', 'round-1', '--limit', '0')).rejects.toThrow('Invalid limit');
        expect(mocks.report).not.toHaveBeenCalled();
    });

    it('explains that a source without a round has no report', async () => {
        mocks.status.mockResolvedValue({ state: 'not_started' });
        await expect(run('report', 'src-1')).rejects.toThrow('no round with a report');
    });
});
