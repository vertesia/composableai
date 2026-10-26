import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseParams } from './dashboards.js';
import { registerDataCommand } from './index.js';

const mocks = vi.hoisted(() => ({
    dashboards: vi.fn(),
    list: vi.fn(),
    export: vi.fn(),
    exportPreview: vi.fn(),
    waitForExport: vi.fn(),
}));
vi.mock('../client.js', () => ({
    getClient: async () => ({ data: { dashboards: mocks.dashboards } }),
}));

const completed = {
    export_id: 'exp-1',
    status: 'completed',
    started_at: '2026-10-26T10:00:00.000Z',
    url: 'https://storage.example/exp-1.png',
    width: 800,
    height: 600,
};

let dir: string;
beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cli-dashboards-'));
    mocks.dashboards.mockReturnValue(mocks);
    mocks.export.mockResolvedValue({ export_id: 'exp-1', status: 'running' });
    mocks.exportPreview.mockResolvedValue({ export_id: 'exp-1', status: 'running' });
    mocks.waitForExport.mockResolvedValue(completed);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
});

async function command(...args: string[]) {
    const program = new Command();
    registerDataCommand(program);
    await program.parseAsync(['data', 'dashboards', ...args], { from: 'user' });
}

function stubDownload(body = 'png-bytes', status = 200) {
    const fetchMock = vi.fn(async () => new Response(body, { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('data dashboards CLI', () => {
    it('lists a store’s dashboards, filtered by status', async () => {
        mocks.list.mockResolvedValue([
            { id: 'd1', name: 'Sales', status: 'active', updated_at: '2026-10-25', last_rendered_at: '2026-10-26' },
        ]);
        await command('list', 'store-1', '--status', 'active');
        expect(mocks.dashboards).toHaveBeenCalledWith('store-1');
        expect(mocks.list).toHaveBeenCalledWith('active');
        expect(vi.mocked(console.log).mock.calls[1][0]).toBe('d1\tSales\tactive\t2026-10-26\t2026-10-25');
        await expect(command('list', 'store-1', '--status', 'deleted')).rejects.toThrow('Invalid --status');
    });

    it('exports a dashboard with parameters and saves the image', async () => {
        const fetchMock = stubDownload();
        const output = join(dir, 'sales.png');
        await command(
            'export',
            'store-1',
            'd1',
            '--param',
            'region=EMEA',
            '--param',
            'filter=a=b',
            '--scale',
            '2',
            '--background',
            '#fff',
            '--timeout',
            '30',
            '-o',
            output,
        );
        expect(mocks.export).toHaveBeenCalledWith('d1', {
            parameter_values: { region: 'EMEA', filter: 'a=b' },
            scale: 2,
            background_color: '#fff',
        });
        expect(mocks.waitForExport).toHaveBeenCalledWith('exp-1', { timeoutMs: 30_000 });
        expect(fetchMock).toHaveBeenCalledWith(completed.url);
        expect(await readFile(output, 'utf8')).toBe('png-bytes');
        expect(console.log).toHaveBeenCalledWith(`Saved ${output} (800x600)`);
    });

    it('reports a failed export with its error code', async () => {
        const fetchMock = stubDownload();
        mocks.waitForExport.mockResolvedValue({
            export_id: 'exp-1',
            status: 'failed',
            started_at: completed.started_at,
            error: { code: 'invalid_spec', message: 'mark is required', retryable: false },
        });
        await expect(command('export', 'store-1', 'd1')).rejects.toThrow(
            'Dashboard export exp-1 failed. invalid_spec: mark is required',
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('prints the export as JSON without downloading it, and exits non-zero when it failed', async () => {
        const fetchMock = stubDownload();
        const failed = { ...completed, status: 'failed', url: undefined };
        mocks.waitForExport.mockResolvedValue(failed);
        await command('export', 'store-1', 'd1', '--json');
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual(failed);
        expect(process.exitCode).toBe(1);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects invalid render options before calling the API', async () => {
        await expect(command('export', 'store-1', 'd1', '--scale', '5')).rejects.toThrow('Invalid --scale');
        await expect(command('export', 'store-1', 'd1', '--timeout', '0')).rejects.toThrow('Invalid --timeout');
        await expect(command('export', 'store-1', 'd1', '--param', '=x')).rejects.toThrow('Invalid --param');
        expect(mocks.export).not.toHaveBeenCalled();
    });

    it('fails when the image download fails', async () => {
        stubDownload('', 403);
        await expect(command('export', 'store-1', 'd1', '-o', join(dir, 'x.png'))).rejects.toThrow('HTTP 403');
    });

    it('exports a preview from a query and a spec read from a file', async () => {
        stubDownload();
        const specFile = join(dir, 'spec.json');
        await writeFile(specFile, JSON.stringify({ mark: 'bar' }));
        const output = join(dir, 'preview.png');
        await command(
            'export-preview',
            'store-1',
            '--query',
            'SELECT 1',
            '--spec',
            `@${specFile}`,
            '--query-limit',
            '100',
            '--param',
            'year=2026',
            '-o',
            output,
        );
        expect(mocks.exportPreview).toHaveBeenCalledWith({
            query: 'SELECT 1',
            spec: { mark: 'bar' },
            queryLimit: 100,
            queryParameters: { year: '2026' },
            scale: undefined,
            background_color: undefined,
        });
        expect(await readFile(output, 'utf8')).toBe('png-bytes');
    });

    it('rejects a preview spec that is not a JSON object', async () => {
        await expect(command('export-preview', 'store-1', '--query', 'SELECT 1', '--spec', '[1]')).rejects.toThrow(
            '--spec must be a JSON object',
        );
        await expect(command('export-preview', 'store-1', '--query', 'SELECT 1', '--spec', '{')).rejects.toThrow(
            '--spec is not valid JSON',
        );
        expect(mocks.exportPreview).not.toHaveBeenCalled();
    });
});

describe('parseParams', () => {
    it('keeps everything after the first = as the value', () => {
        expect(parseParams(['a=1', 'b=', 'c=x=y'])).toEqual({ a: '1', b: '', c: 'x=y' });
        expect(parseParams([])).toBeUndefined();
        expect(() => parseParams(['novalue'])).toThrow('Expected key=value');
    });
});
