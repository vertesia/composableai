import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from './index.js';

const mocks = vi.hoisted(() => ({
    home: '',
    answers: {} as Record<string, string>,
    profiles: [] as Profile[],
    start: vi.fn(),
    createProfile: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock('node:os', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:os')>();
    const homedir = () => mocks.home;
    return { ...actual, homedir, default: { ...actual, homedir } };
});
// enquirer normalises `choices` in place, replacing each string with a choice object.
vi.mock('enquirer', () => ({
    default: {
        prompt: async (input: { name: string; choices?: unknown[] } | { name: string; choices?: unknown[] }[]) => {
            const questions = Array.isArray(input) ? input : [input];
            const answers: Record<string, string> = {};
            for (const question of questions) {
                question.choices?.forEach((choice, index, choices) => {
                    choices[index] = typeof choice === 'string' ? { name: choice, value: choice } : choice;
                });
                answers[question.name] = mocks.answers[question.name];
            }
            return answers;
        },
    },
}));
vi.mock('./auth.js', () => ({ refreshProfileAuthentication: mocks.refresh }));
vi.mock('./index.js', async (importOriginal) => {
    mocks.home = mkdtempSync(join(tmpdir(), 'cli-commands-test-'));
    const actual = await importOriginal<typeof import('./index.js')>();
    return {
        ...actual,
        config: {
            isDevMode: false,
            get current() {
                return undefined;
            },
            hasProfile: (name: string) => mocks.profiles.some((p) => p.name === name),
            getProfile: (name: string) => mocks.profiles.find((p) => p.name === name),
            createProfile: mocks.createProfile,
        },
    };
});

const { createProfile, loginProfile } = await import('./commands.js');
const { AVAILABLE_REGIONS } = await import('./index.js');

class ExitError extends Error {}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.answers = {};
    mocks.profiles = [];
    mocks.createProfile.mockReturnValue({ start: mocks.start });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new ExitError(`exit ${code}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('createProfile', () => {
    it.each(['eu1', 'jp1'])('keeps the region picked at the prompt (%s)', async (region) => {
        mocks.answers = { target: 'preview', region };
        await createProfile('new');
        expect(mocks.createProfile).toHaveBeenCalledWith('new', 'preview', region, {});
        expect(AVAILABLE_REGIONS).toEqual(['us1', 'eu1', 'jp1']);
    });

    it('rejects a name that already exists instead of overwriting its credential', async () => {
        mocks.profiles = [{ name: 'taken' } as Profile];
        await expect(createProfile('taken', { target: 'prod', apikey: 'key' })).rejects.toThrow(ExitError);
        expect(mocks.createProfile).not.toHaveBeenCalled();
    });

    it('passes --account and --project to the sign-in', async () => {
        await createProfile('new', { target: 'prod', region: 'eu1', account: 'acc', project: 'proj' });
        expect(mocks.createProfile).toHaveBeenCalledWith('new', 'prod', 'eu1', { account: 'acc', project: 'proj' });
    });
});

describe('loginProfile on an existing profile', () => {
    const existing: Profile = {
        name: 'eu',
        account: 'acc',
        project: 'proj',
        region: 'eu1',
        config_url: 'https://preview.cloud.eu1.vertesia.io/cli',
        studio_server_url: 'https://api-preview.eu1.vertesia.io',
        zeno_server_url: 'https://api-preview.eu1.vertesia.io',
    };

    beforeEach(() => {
        mocks.profiles = [existing];
    });

    it('refreshes when the options match the profile', async () => {
        await loginProfile('eu', { target: 'preview', region: 'eu1', account: 'acc' });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it('treats a profile without a region as us1', async () => {
        mocks.profiles = [{ ...existing, region: undefined, config_url: 'https://preview.cloud.us1.vertesia.io/cli' }];
        await loginProfile('eu', { target: 'preview' });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it.each([{ region: 'eu1' }, { target: 'preview' }, { target: 'preview', region: 'eu1' }])(
        'reads the region from the URL of a profile made from a custom URL (%o)',
        async (options) => {
            // A custom-URL profile stores the default region whatever its URL points at.
            mocks.profiles = [{ ...existing, region: 'us1' }];
            await loginProfile('eu', options);
            expect(mocks.refresh).toHaveBeenCalledOnce();
        },
    );

    it('ignores --region for a profile that has no region', async () => {
        mocks.profiles = [{ ...existing, region: 'us1', config_url: 'https://dev-main.ui.dev1.vertesia.io/cli' }];
        await loginProfile('eu', { region: 'eu1' });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it('reports an unusable --target without a stack trace', async () => {
        await expect(loginProfile('eu', { target: 'custom' })).rejects.toThrow(ExitError);
        expect(console.error).toHaveBeenCalledWith('Custom targets must be a valid http or https URL.');
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it.each([{ target: 'prod' }, { target: 'preview', region: 'us1' }, { region: 'us1' }, { account: 'other' }])(
        'rejects options that describe another profile (%o)',
        async (options) => {
            await expect(loginProfile('eu', options)).rejects.toThrow(ExitError);
            expect(mocks.refresh).not.toHaveBeenCalled();
        },
    );
});
