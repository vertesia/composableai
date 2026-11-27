import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigResult } from './server/index.js';

const mocks = vi.hoisted(() => ({ home: '' }));

vi.mock('node:os', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:os')>();
    const homedir = () => mocks.home;
    return { ...actual, homedir, default: { ...actual, homedir } };
});
// No native credential backend: the login result falls back to the profile file.
vi.mock('./keyring.js', () => ({
    deleteAuthBundle: async () => undefined,
    hasStoredAccessToken: async () => false,
    isKeyringAvailable: () => false,
    readAuthBundle: async () => undefined,
    readUsableProfileToken: async () => undefined,
    writeAuthBundle: async () => {
        throw new Error('No native secrets backend is available');
    },
    writeRefreshedAuthBundle: async () => {
        throw new Error('No native secrets backend is available');
    },
}));

const { Config, ConfigureProfile } = await import('./index.js');

const result: ConfigResult = {
    profile: 'fallback',
    account: 'account',
    project: 'project',
    studio_server_url: 'https://api.example.test',
    zeno_server_url: 'https://store.example.test',
    token: 'fallback-bearer-token',
};

let previousUmask: number;

function modeOf(path: string) {
    return statSync(path).mode & 0o777;
}

async function loginWithoutKeyring() {
    const config = new Config();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await new ConfigureProfile(config, { config_url: 'https://ui.example.test/cli' }, true).persistConfigResult(result);
}

beforeEach(async () => {
    mocks.home = await mkdtemp(join(tmpdir(), 'cli-profiles-test-'));
    // A typical permissive umask: without explicit modes, files come out 0644 and directories 0755.
    previousUmask = process.umask(0o022);
});

afterEach(async () => {
    process.umask(previousUmask);
    vi.restoreAllMocks();
    await rm(mocks.home, { recursive: true, force: true });
});

describe.skipIf(process.platform === 'win32')('profile file permissions', () => {
    it('writes the fallback credential to an owner-only file in an owner-only directory', async () => {
        await loginWithoutKeyring();

        const dir = join(mocks.home, '.vertesia');
        const file = join(dir, 'profiles.json');
        expect(readFileSync(file, 'utf8')).toContain(result.token);
        expect(modeOf(file)).toBe(0o600);
        expect(modeOf(dir)).toBe(0o700);
    });

    it('tightens an existing world-readable profile file and directory before writing the credential', async () => {
        const dir = join(mocks.home, '.vertesia');
        const file = join(dir, 'profiles.json');
        mkdirSync(dir, { mode: 0o755 });
        chmodSync(dir, 0o755);
        writeFileSync(file, JSON.stringify({ profiles: [] }), { mode: 0o644 });
        chmodSync(file, 0o644);

        await loginWithoutKeyring();

        expect(readFileSync(file, 'utf8')).toContain(result.token);
        expect(modeOf(file)).toBe(0o600);
        expect(modeOf(dir)).toBe(0o700);
    });
});

describe('default profile', () => {
    const profile = (name: string) => ({
        name,
        account: 'account',
        project: 'project',
        config_url: 'https://ui.example.test/cli',
        studio_server_url: 'https://api.example.test',
        zeno_server_url: 'https://store.example.test',
    });

    async function loadConfig() {
        const dir = join(mocks.home, '.vertesia');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, 'profiles.json'),
            JSON.stringify({ default: 'a', profiles: [profile('a'), profile('b')] }),
        );
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        return await new Config().load();
    }

    function savedDefault() {
        return JSON.parse(readFileSync(join(mocks.home, '.vertesia', 'profiles.json'), 'utf8')).default;
    }

    it('keeps the default when a --profile override refreshes its token', async () => {
        const config = await loadConfig();
        config.use('b', { explicit: true });
        await config.updateProfile('b').persistConfigResult({ ...result, profile: 'b' });
        expect(savedDefault()).toBe('a');
        expect(config.current?.name).toBe('b');
    });

    it('makes a profile created under a --profile override the default', async () => {
        const config = await loadConfig();
        config.use('b', { explicit: true });
        await new ConfigureProfile(config, profile('c'), true).persistConfigResult({ ...result, profile: 'c' });
        expect(savedDefault()).toBe('c');
    });

    it('still selects the profile a login names', async () => {
        const config = await loadConfig();
        await config.updateProfile('b').persistConfigResult({ ...result, profile: 'b' });
        expect(savedDefault()).toBe('b');
    });

    it('clears the default when the default profile is deleted', async () => {
        const config = await loadConfig();
        await config.remove('a').save();
        expect(savedDefault()).toBeUndefined();
    });
});
