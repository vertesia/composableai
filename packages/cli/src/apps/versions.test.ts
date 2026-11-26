import { VertesiaClient } from '@vertesia/client';
import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAppsCommand } from './index.js';

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('../client.js', () => ({ getClient: mocks.getClient }));
// Build progress is polled; the interval is not what these tests are about.
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => undefined) }));

const recordId = '0123456789abcdef01234567';
let requests: Request[];
let progress: object[];

async function command(...args: string[]) {
    const program = new Command().exitOverride().configureOutput({ writeErr: () => undefined });
    registerAppsCommand(program);
    await program.parseAsync(['apps', 'versions', ...args], { from: 'user' });
}
function route(index = 0) {
    return new URL(requests[index].url).pathname;
}
function printed() {
    return vi.mocked(console.log).mock.calls.map(([line]) => String(line));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    requests = [];
    progress = [];
    const client = new VertesiaClient({
        serverUrl: 'https://api.example.test',
        storeUrl: 'https://store.example.test',
        onRequest: (request) => requests.push(request),
        fetch: vi.fn(async () => {
            const url = route(requests.length - 1);
            if (url.endsWith('/progress')) return Response.json(progress.shift());
            if (url.endsWith('/builds'))
                return Response.json({ workflow_id: 'AppBuild:1', run_id: 'run-1', app_id: 'site' });
            if (url.endsWith('/launches'))
                return Response.json({ version_launch_id: 'l1', app_url: 'https://app.test/l1' });
            if (url.endsWith('/promote')) return Response.json({ version: { id: recordId, promoted: true } });
            return Response.json([{ id: recordId, version_id: '20260101T000000000Z', state: 'ready' }]);
        }),
    });
    mocks.getClient.mockResolvedValue(client);
});

describe('apps versions', () => {
    it('lists one app with a limit', async () => {
        await command('list', 'site', '--limit', '5');
        const url = new URL(requests[0].url);
        expect(url.pathname).toBe('/api/v1/apps/versions');
        expect(url.searchParams.get('app_id')).toBe('site');
        expect(url.searchParams.get('limit')).toBe('5');
    });

    it('builds from a ref and follows progress until the version is ready', async () => {
        progress = [
            { status: 'building', step: 'building', updated_at: '' },
            { status: 'building', step: 'building', updated_at: '' },
            {
                status: 'completed',
                step: 'completed',
                version_id: 'v2',
                app_url: 'https://app.test/v2',
                updated_at: '',
            },
        ];
        await command('build', 'site', '--source-ref', 'agent/title-tweak', '--target', 'static');

        expect(route(0)).toBe('/api/v1/apps/site/builds');
        expect(await requests[0].clone().json()).toEqual({
            trigger: 'api',
            source_ref: 'agent/title-tweak',
            target: 'static',
        });
        expect(route(1)).toBe('/api/v1/apps/site/builds/AppBuild%3A1/run-1/progress');
        // A repeated step prints once, so a long build does not flood an agent's context.
        expect(printed().filter((line) => line === '[building] building')).toHaveLength(1);
        expect(JSON.parse(printed().at(-1) ?? '{}')).toMatchObject({
            version_id: 'v2',
            app_url: 'https://app.test/v2',
        });
    });

    it('fails with the build error so a script can tell', async () => {
        progress = [{ status: 'failed', step: 'failed', error: 'tsc found 2 errors', updated_at: '' }];
        await expect(command('build', 'site')).rejects.toThrow('Build failed: tsc found 2 errors');
    });

    it('returns after starting with --no-follow, building the service target like Studio', async () => {
        await command('build', 'site', '--no-follow');
        expect(requests).toHaveLength(1);
        expect(await requests[0].clone().json()).toEqual({ trigger: 'api', target: 'service' });
    });

    it('rejects an unknown target before signing in', async () => {
        await expect(command('build', 'site', '--target', 'edge')).rejects.toThrow('--target must be one of');
        expect(mocks.getClient).not.toHaveBeenCalled();
    });

    it('launches a version with empty temporary settings by default', async () => {
        await command('launch', recordId);
        expect(route()).toBe(`/api/v1/apps/versions/${recordId}/launches`);
        expect(await requests[0].clone().json()).toEqual({ settings: {} });
        expect(JSON.parse(printed()[0])).toMatchObject({ app_url: 'https://app.test/l1' });
    });

    it('launches in another project with settings', async () => {
        await command('launch', recordId, '--project', 'project-2', '--settings', '{"mode":"demo"}');
        expect(await requests[0].clone().json()).toEqual({
            target_project_id: 'project-2',
            settings: { mode: 'demo' },
        });
    });

    it('promotes a version by its record id', async () => {
        await command('promote', recordId);
        expect(requests[0].method).toBe('POST');
        expect(route()).toBe(`/api/v1/apps/versions/${recordId}/promote`);
    });

    it.each(['launch', 'promote'])('points %s at the record id when given a version id', async (subcommand) => {
        await expect(command(subcommand, '20260101T000000000Z')).rejects.toThrow('apps versions list');
        expect(mocks.getClient).not.toHaveBeenCalled();
    });
});
