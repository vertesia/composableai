import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerOidcFederationCommand } from './index.js';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    exchangeToken: vi.fn(),
    getClient: vi.fn(),
    construct: vi.fn(),
    readFile: vi.fn(),
    readStdin: vi.fn(),
}));
vi.mock('../client.js', () => ({ getClient: mocks.getClient }));
vi.mock('../utils/stdio.js', () => ({ readFile: mocks.readFile, readStdin: mocks.readStdin }));
vi.mock('@vertesia/client', () => ({
    VertesiaClient: class {
        constructor(options: unknown) {
            mocks.construct(options);
        }
        oauthServer = { exchangeToken: mocks.exchangeToken };
    },
}));
const policy = {
    name: 'Example integration',
    issuer: 'https://identity.example.com',
    external_id_claim: 'oid',
    allowed_audiences: ['integration'],
    allowed_algorithms: ['RS256'],
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    required_claims: { azp: 'trusted-app' },
    allowed_project_ids: ['012345678901234567890123'],
    allowed_scopes: ['content:read'],
    max_token_ttl_seconds: 300,
    enabled: false,
};
async function command(...args: string[]) {
    const program = new Command().exitOverride();
    registerOidcFederationCommand(program);
    await program.parseAsync(['oidc-federation', ...args], { from: 'user' });
}
beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.getClient.mockResolvedValue({ oidcFederation: mocks });
    mocks.readFile.mockReturnValue(JSON.stringify(policy));
    mocks.readStdin.mockResolvedValue(JSON.stringify(policy));
    mocks.retrieve.mockResolvedValue({ ...policy, id: 'connection', account_id: 'account' });
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});
describe('oidc-federation CLI', () => {
    it('lists and inspects account-owned connections', async () => {
        await command('list');
        await command('get', 'connection');
        expect(mocks.list).toHaveBeenCalledOnce();
        expect(mocks.retrieve).toHaveBeenCalledWith('connection');
    });
    it('creates from a file and replaces from stdin without extra fields', async () => {
        await command('create', '--file', 'policy.json');
        expect(mocks.create).toHaveBeenCalledWith(policy);
        await command('update', 'connection', '--file', '-');
        expect(mocks.readStdin).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledWith('connection', policy);
    });
    it('preserves all-project mode through create, replacement and emergency disable', async () => {
        const all = { ...policy, all_projects: true, allowed_project_ids: [] };
        mocks.readFile.mockReturnValue(JSON.stringify(all));
        await command('create', '--file', 'all-projects.json');
        expect(mocks.create).toHaveBeenCalledWith(all);
        await command('update', 'connection', '--file', 'all-projects.json');
        expect(mocks.update).toHaveBeenCalledWith('connection', all);
        mocks.retrieve.mockResolvedValue({ ...all, id: 'connection', account_id: 'account' });
        await command('disable', 'connection');
        expect(mocks.update).toHaveBeenLastCalledWith('connection', { ...all, enabled: false });
    });
    it('rejects malformed policies before resolving a client', async () => {
        mocks.readFile.mockReturnValue(JSON.stringify({ ...policy, unknown_configuration: ['caller'] }));
        await expect(command('create', '--file', 'bad.json')).rejects.toThrow('Invalid federation');
        expect(mocks.getClient).not.toHaveBeenCalled();
    });
    it.each([
        ['enable', true],
        ['disable', false],
    ] as const)('sets %s without losing signed claim or scope restrictions', async (action, enabled) => {
        await command(action, 'connection');
        expect(mocks.update).toHaveBeenCalledWith('connection', { ...policy, enabled });
    });
    it('requires explicit deletion confirmation', async () => {
        await expect(command('delete', 'connection')).rejects.toThrow('--yes');
        expect(mocks.remove).not.toHaveBeenCalled();
        await command('delete', 'connection', '--yes');
        expect(mocks.remove).toHaveBeenCalledWith('connection');
    });
    const exchangeOptions = [
        'exchange',
        '--sts-url',
        'https://sts.example.com',
        '--connection',
        '012345678901234567890124',
        '--project',
        '012345678901234567890123',
        '--resource',
        'https://api.example.com/',
        '--scope',
        'content:read',
        '--subject-token-file',
        '-',
    ];
    it('exchanges a JWT from stdin without loading an authenticated client or supplying a secret', async () => {
        mocks.readStdin.mockResolvedValue('signed-idp-token\n');
        mocks.exchangeToken.mockResolvedValue({ access_token: 'result' });
        await command(...exchangeOptions);
        expect(mocks.getClient).not.toHaveBeenCalled();
        expect(mocks.construct).toHaveBeenCalledWith({
            serverUrl: 'https://sts.example.com',
            storeUrl: 'https://sts.example.com',
            tokenServerUrl: 'https://sts.example.com',
        });
        expect(mocks.exchangeToken).toHaveBeenCalledWith({
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            subject_token: 'signed-idp-token',
            subject_token_type: policy.subject_token_type,
            federation_connection_id: '012345678901234567890124',
            project_id: policy.allowed_project_ids[0],
            resource: 'https://api.example.com/',
            scope: 'content:read',
        });
    });
    it.each(['client_secret_post', 'client_secret_basic'])('reads %s credentials from a file', async (method) => {
        mocks.readStdin.mockResolvedValue('signed-user-token');
        mocks.readFile.mockReturnValue('middleware-secret\n');
        await command(
            ...exchangeOptions,
            '--client-id',
            'vts_client',
            '--client-secret-file',
            'secret.txt',
            '--client-auth-method',
            method,
        );
        const [payload, basic] = mocks.exchangeToken.mock.calls[0];
        expect(payload.client_id).toBe('vts_client');
        if (method === 'client_secret_post') {
            expect(payload.client_secret).toBe('middleware-secret');
            expect(basic).toBeUndefined();
        } else {
            expect(payload.client_secret).toBeUndefined();
            expect(basic).toEqual({ client_id: 'vts_client', client_secret: 'middleware-secret' });
        }
    });
    it('reads a signed client assertion without handling private signing keys', async () => {
        mocks.readStdin.mockResolvedValue('signed-user-token');
        mocks.readFile.mockReturnValue('signed-client-assertion');
        await command(...exchangeOptions, '--client-id', 'vts_client', '--client-assertion-file', 'assertion.jwt');
        expect(mocks.exchangeToken).toHaveBeenCalledWith(
            expect.objectContaining({
                client_assertion: 'signed-client-assertion',
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            }),
        );
    });
    it('rejects untrusted STS URLs and empty assertions before sending credentials', async () => {
        await expect(
            command(
                ...exchangeOptions.map((v) => (v === 'https://sts.example.com' ? 'http://untrusted.example.com' : v)),
            ),
        ).rejects.toThrow('HTTPS');
        mocks.readStdin.mockResolvedValue('');
        await expect(command(...exchangeOptions)).rejects.toThrow('Invalid exchange');
        expect(mocks.exchangeToken).not.toHaveBeenCalled();
    });
});
