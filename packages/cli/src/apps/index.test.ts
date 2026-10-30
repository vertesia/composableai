import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VertesiaClient } from '@vertesia/client';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAppsCommand } from './index.js';

const mocks = vi.hoisted(() => ({ getClient: vi.fn(), readStdin: vi.fn() }));
vi.mock('../client.js', () => ({ getClient: mocks.getClient }));
vi.mock('../utils/stdio.js', () => ({ readStdin: mocks.readStdin }));

const installation = {
    id: 'install-eu',
    instance_key: 'eu',
    display_name: 'Europe',
    namespace_overrides: { crm: 'crm_eu' },
    manifest: { id: 'manifest-crm', name: 'crm' },
};
const legacy = { id: 'install-default', manifest: installation.manifest };
let requests: Request[];
let directory: string;
let installations: object[];
let responseError: number | undefined;
let connectionSuccess: boolean;
async function command(...args: string[]) {
    const program = new Command().exitOverride().configureOutput({ writeErr: () => undefined });
    registerAppsCommand(program);
    await program.parseAsync(['apps', ...args], { from: 'user' });
}
async function inputFile(value: unknown, name = 'input.json') {
    const path = join(directory, name);
    await writeFile(path, JSON.stringify(value));
    return path;
}
async function payload(index = 0) {
    return requests[index].clone().json();
}
function route(index = 0) {
    return new URL(requests[index].url).pathname;
}

beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    directory = await mkdtemp(join(tmpdir(), 'cli-apps-'));
    requests = [];
    installations = [legacy, installation];
    responseError = undefined;
    connectionSuccess = true;
    const client = new VertesiaClient({
        serverUrl: 'https://api.example.test',
        storeUrl: 'https://store.example.test',
        onRequest: (request) => requests.push(request),
        fetch: vi.fn(async () => {
            if (responseError)
                return Response.json({ message: 'Namespace cannot be changed' }, { status: responseError });
            const url = route(requests.length - 1);
            if (url.endsWith('/aces')) return Response.json([]);
            if (url.endsWith('/installations')) return Response.json(installations);
            if (url.includes('/name/')) return Response.json(legacy);
            if (url.includes('/api-key')) return Response.json({ configured: true, hint: '…last' });
            if (url.includes('/authorize/'))
                return Response.json({ authorization_url: 'https://oauth.example/authorize', state: 'state-eu' });
            if (url.includes('/remote-mcp-connections/')) return Response.json({ success: connectionSuccess });
            return Response.json(installation);
        }),
    });
    mocks.getClient.mockResolvedValue(client);
});
afterEach(async () => {
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
});

describe('instance selection', () => {
    it('preserves name lookup for the default and reads its permissions', async () => {
        await command('get-installation', 'crm');
        expect(route()).toBe('/api/v1/apps/installations/name/crm');
        expect(new URL(requests[1].url).searchParams.get('resource')).toBe('install-default');
    });
    it('does not reinterpret a hex-shaped legacy app name as an installation ID', async () => {
        await command('get-installation', '0123456789abcdef01234567');
        expect(route()).toBe('/api/v1/apps/installations/name/0123456789abcdef01234567');
    });
    it('preserves the legacy missing-name message without inspecting sibling permissions', async () => {
        responseError = 404;
        await command('get-installation', 'missing-app');
        expect(vi.mocked(console.log).mock.calls[0][0]).toContain('is not installed');
        expect(requests).toHaveLength(1);
    });
    it('does not fall back from a missing installation ID to app-name lookup', async () => {
        responseError = 404;
        await expect(command('get-installation', 'install-eu', '--id')).rejects.toMatchObject({ status: 404 });
        expect(requests).toHaveLength(1);
        expect(route()).toBe('/api/v1/apps/installations/id/install-eu');
    });
    it('looks up an exact installation ID without resolving an app name', async () => {
        await command('get-installation', 'install-eu', '--id');
        expect(route()).toBe('/api/v1/apps/installations/id/install-eu');
        expect(new URL(requests[1].url).searchParams.get('resource')).toBe('install-eu');
        expect(requests).toHaveLength(2);
    });
    it.each(['crm', 'manifest-crm'])('selects a named instance of %s without using a sibling', async (name) => {
        await command('get-installation', name, '--instance-key', 'eu');
        expect(route()).toBe('/api/v1/apps/installations');
        expect(new URL(requests[1].url).searchParams.get('resource')).toBe('install-eu');
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0]).id).toBe('install-eu');
    });
    it('rejects an ambiguous app name rather than choosing the first installation', async () => {
        installations = [
            installation,
            { ...installation, id: 'other-eu', manifest: { id: 'other-manifest', name: 'crm' } },
        ];
        await expect(command('get-installation', 'crm', '--instance-key', 'eu')).rejects.toThrow('ambiguous');
        expect(requests).toHaveLength(1);
    });
    it('treats a missing legacy key as default', async () => {
        await command('get-installation', 'crm', '--instance-key', 'default');
        expect(new URL(requests[1].url).searchParams.get('resource')).toBe('install-default');
    });
    it('fails closed when the requested instance is absent or inaccessible', async () => {
        installations = [legacy];
        await expect(command('get-installation', 'crm', '--instance-key', 'eu')).rejects.toThrow(
            'not found or not accessible',
        );
        expect(requests).toHaveLength(1);
    });
    it('rejects conflicting selectors before authentication', async () => {
        await expect(command('get-installation', 'crm', '--id', '--instance-key', 'eu')).rejects.toThrow(
            'cannot be combined',
        );
        expect(mocks.getClient).not.toHaveBeenCalled();
    });
    it('lists keys, labels, IDs and namespaces and preserves legacy defaults', async () => {
        await command('list-installed', '--kind', 'tool');
        const output = vi.mocked(console.log).mock.calls.flat().join('\n');
        expect(output).toContain('Instance Key: default');
        expect(output).toContain('Instance Key: eu');
        expect(output).toContain('Display Name: Europe');
        expect(output).toContain('Installation ID: install-eu');
        expect(output).toContain('"crm":"crm_eu"');
        expect(new URL(requests[0].url).searchParams.get('kind')).toBe('tool');
    });
    it('uninstalls the exact selected instance', async () => {
        await command('uninstall', 'install-eu');
        expect(route()).toBe('/api/v1/apps/install/install-eu');
        expect(requests[0].method).toBe('DELETE');
    });
    it('offers complete JSON output, including an empty list', async () => {
        installations = [];
        await command('list-installed', '--json');
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual([]);
    });
});

describe('install and partial settings updates', () => {
    it('can install without granting app OAuth access', async () => {
        await command('install', 'manifest-crm', '--approved-scopes', '');
        expect(await payload()).toEqual({ app_id: 'manifest-crm', approved_scopes: [] });
    });
    it('forwards the selected app OAuth approval scopes', async () => {
        await command('install', 'manifest-crm', '--approved-scopes', 'openid, content:read');
        expect(await payload()).toEqual({ app_id: 'manifest-crm', approved_scopes: ['openid', 'content:read'] });
    });
    it('keeps legacy installation payloads compatible', async () => {
        await command('install', 'manifest-crm', '--settings', '{"region":"eu"}');
        expect(await payload()).toEqual({ app_id: 'manifest-crm', settings: { region: 'eu' } });
    });
    it('forwards separate credentials and MCP parameters with instance identity', async () => {
        const credentials = {
            oauth_params: { crm: { client_id: 'eu-client', client_secret: 'secret-eu', scopes: ['read'] } },
            oauth_provider_params: { shared: { client_id: 'other-client', client_secret: 'secret-provider' } },
            api_key_params: { reports: { api_key: 'secret-key' } },
        };
        await command(
            'install',
            'manifest-crm',
            '--instance-key',
            'eu',
            '--display-name',
            'Europe',
            '--namespaces',
            '{"crm":"crm_eu","reports":"reports_eu"}',
            '--credentials-file',
            await inputFile(credentials),
            '--mcp-parameters',
            '{"crm":{"region":"eu","token":"secret-param"}}',
            '--mcp-shared-parameters',
            '{"tenant":"europe"}',
        );
        expect(await payload()).toEqual({
            app_id: 'manifest-crm',
            instance_key: 'eu',
            display_name: 'Europe',
            namespace_overrides: { crm: 'crm_eu', reports: 'reports_eu' },
            ...credentials,
            mcp_parameters: { crm: { region: 'eu', token: 'secret-param' } },
            mcp_shared_parameters: { tenant: 'europe' },
        });
        expect(vi.mocked(console.log).mock.calls.flat().join('\n')).not.toMatch(
            /secret-eu|secret-provider|secret-key|secret-param/,
        );
    });
    it('renames without clearing settings, credentials or namespaces', async () => {
        await command('settings', 'install-eu', '--display-name', 'Europe 2');
        expect(route()).toBe('/api/v1/apps/installations/settings/install-eu');
        expect(await payload()).toEqual({ app_id: 'install-eu', display_name: 'Europe 2' });
    });
    it('allocates publisher-added collections without replacing installation identity', async () => {
        await command('settings', 'install-eu', '--namespaces-file', await inputFile({ new_collection: 'new_eu' }));
        expect(await payload()).toEqual({ app_id: 'install-eu', namespace_overrides: { new_collection: 'new_eu' } });
    });
    it('forwards parameter removals and empty settings from files', async () => {
        await command(
            'settings',
            'install-eu',
            '--settings-file',
            await inputFile({}),
            '--mcp-parameters-file',
            await inputFile({ crm: { region: null, token: 'secret-new' } }, 'params.json'),
            '--mcp-shared-parameters-file',
            await inputFile({ tenant: null }, 'shared.json'),
        );
        expect(await payload()).toEqual({
            app_id: 'install-eu',
            settings: {},
            mcp_parameters: { crm: { region: null, token: 'secret-new' } },
            mcp_shared_parameters: { tenant: null },
        });
    });
    it.each(['all', 'ui', 'none', 'null'])('preserves explicit access-control policy %s', async (policy) => {
        await command('settings', 'install-eu', '--access-control', policy);
        expect(await payload()).toEqual({ app_id: 'install-eu', access_control: policy === 'null' ? null : policy });
    });
    it('does not suppress a server rejection of immutable namespace changes', async () => {
        responseError = 400;
        await expect(command('settings', 'install-eu', '--namespaces', '{"crm":"renamed"}')).rejects.toMatchObject({
            status: 400,
        });
    });
    it.each([
        [],
        ['--display-name', ' '],
        ['--namespaces', '{"crm":42}'],
        ['--namespaces', '[]'],
        ['--mcp-parameters', '{"crm":42}'],
        ['--mcp-shared-parameters', '{"token":true}'],
        ['--access-control', 'invalid'],
        ['--instance-key', 'rename'],
    ])('rejects invalid or empty updates before HTTP: %j', async (...options) => {
        await expect(command('settings', 'install-eu', ...options)).rejects.toThrow();
        expect(requests).toHaveLength(0);
    });
    it('rejects simultaneous inline and file inputs instead of silently choosing one', async () => {
        await expect(
            command('settings', 'install-eu', '--settings', '{}', '--settings-file', await inputFile({})),
        ).rejects.toThrow('either --settings or --settings-file');
        expect(requests).toHaveLength(0);
    });
    it.each([
        { oauth_params: { crm: { client_secret: 123 } } },
        { oauth_params: { crm: { scopes: [42] } } },
        { oauth_provider_params: [] },
        { oauth_params: { crm: { secret: 'secret-value' } } },
        { api_key_params: { crm: { api_key: '' } } },
        { api_key_params: { crm: 'secret-value' } },
        { api_key_params: { crm: { api_key: 'secret-value', extra: true } } },
        { unexpected: 'secret-value' },
    ])('rejects invalid credential files before sending requests: %j', async (credentials) => {
        await expect(
            command('install', 'manifest-crm', '--credentials-file', await inputFile(credentials)),
        ).rejects.toThrow();
        expect(requests).toHaveLength(0);
        expect(mocks.getClient).not.toHaveBeenCalled();
    });
    it('does not expose malformed credential contents in errors or console output', async () => {
        const path = join(directory, 'bad.json');
        await writeFile(path, '{"client_secret": "secret-value", INVALID}');
        const error = await command('install', 'manifest-crm', '--credentials-file', path).catch((err: unknown) => err);
        expect(error).toBeInstanceOf(Error);
        expect(String(error)).not.toContain('secret-value');
        expect(console.log).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });
});

describe('installation-scoped credentials', () => {
    it('rotates a key from a file and never prints it', async () => {
        const path = join(directory, 'key.txt');
        await writeFile(path, '  secret-key\n');
        await command('api-key', 'set', 'install-eu', 'crm', '--key-file', path);
        expect(route()).toBe('/api/v1/apps/installations/install-eu/collections/crm/api-key');
        expect(requests[0].method).toBe('PUT');
        expect(await payload()).toEqual({ api_key: 'secret-key' });
        expect(vi.mocked(console.log).mock.calls.flat().join('\n')).not.toContain('secret-key');
    });
    it('accepts a piped API key', async () => {
        mocks.readStdin.mockResolvedValue('secret-piped\n');
        await command('api-key', 'set', 'install-eu', 'crm', '--stdin');
        expect(await payload()).toEqual({ api_key: 'secret-piped' });
        expect(vi.mocked(console.log).mock.calls.flat().join('\n')).not.toContain('secret-piped');
    });
    it('reads only masked status and deletes only the selected installation key', async () => {
        await command('api-key', 'status', 'install-eu', 'crm');
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({ configured: true, hint: '…last' });
        await command('api-key', 'delete', 'install-eu', 'crm');
        expect(requests.map((request) => request.method)).toEqual(['GET', 'DELETE']);
        expect(route(1)).toBe(route(0));
        expect(route()).not.toContain('/apps/manifest-crm/');
    });
    it('keeps sibling instance credential requests distinct', async () => {
        await command('api-key', 'delete', 'install-default', 'crm');
        await command('api-key', 'delete', 'install-eu', 'crm');
        expect(route(0)).toContain('/installations/install-default/');
        expect(route(1)).toContain('/installations/install-eu/');
    });
    it('requires one nonempty key source before authentication', async () => {
        await expect(command('api-key', 'set', 'install-eu', 'crm')).rejects.toThrow('exactly one');
        await expect(command('api-key', 'set', 'install-eu', 'crm', '--key-file', 'unused', '--stdin')).rejects.toThrow(
            'exactly one',
        );
        mocks.readStdin.mockResolvedValue('\n');
        await expect(command('api-key', 'set', 'install-eu', 'crm', '--stdin')).rejects.toThrow('must not be empty');
        expect(mocks.getClient).not.toHaveBeenCalled();
    });
    it.each([
        ['status', 'install-eu'],
        ['status', 'install-eu', 'crm'],
        ['authorize', 'install-eu', 'crm'],
        ['connect', 'install-eu', 'crm'],
        ['disconnect', 'install-eu', 'crm'],
    ])('scopes OAuth %s to the requested installation', async (...args) => {
        await command('connections', ...args);
        expect(route()).toBe(`/api/v1/remote-mcp-connections/${args.join('/')}`);
        expect(requests[0].method).toBe(args[0] === 'connect' ? 'POST' : args[0] === 'disconnect' ? 'DELETE' : 'GET');
        expect(route()).not.toContain('/token');
    });
    it('completes OAuth authorization using a callback response file without printing the code', async () => {
        await command(
            'connections',
            'exchange',
            '--response-file',
            await inputFile({ code: 'secret-code', state: 'state-eu' }),
        );
        expect(route()).toBe('/api/v1/remote-mcp-connections/exchange');
        expect(await payload()).toEqual({ code: 'secret-code', state: 'state-eu' });
        expect(vi.mocked(console.log).mock.calls.flat().join('\n')).not.toContain('secret-code');
    });
    it.each(['connect', 'disconnect', 'exchange'])(
        'does not report a failed OAuth %s as success',
        async (operation) => {
            connectionSuccess = false;
            const args =
                operation === 'exchange'
                    ? ['exchange', '--response-file', await inputFile({ code: 'secret-code', state: 'state-eu' })]
                    : [operation, 'install-eu', 'crm'];
            await expect(command('connections', ...args)).rejects.toThrow('did not succeed');
            expect(console.log).not.toHaveBeenCalled();
        },
    );
    it('rejects an invalid OAuth callback before requesting an exchange', async () => {
        await expect(
            command('connections', 'exchange', '--response-file', await inputFile({ code: 'secret-code' })),
        ).rejects.toThrow('code and state');
        expect(mocks.getClient).not.toHaveBeenCalled();
    });
});
