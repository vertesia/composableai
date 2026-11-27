import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRunsCommand, runSearchTags } from './index.js';

const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('../client.js', () => ({ getClient: async () => ({ runs: mocks }) }));

async function runs(...options: string[]) {
    const program = new Command().exitOverride();
    registerRunsCommand(program);
    await program.parseAsync(['runs', ...options], { from: 'user' });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('runSearchTags', () => {
    it('returns the app tag for --app, merged with --tags', () => {
        expect(runSearchTags('a, b', 'horse-tinder-p1-1')).toEqual(['a', 'b', 'app:horse-tinder-p1-1']);
    });

    it('returns no tag filter when neither option is given', () => {
        expect(runSearchTags(undefined, undefined)).toBeUndefined();
    });
});

describe('runs --app', () => {
    it('searches by the app tag the server writes on the app runs', async () => {
        await runs('--app', 'horse-tinder-p1-1');
        expect(mocks.search).toHaveBeenCalledWith(
            expect.objectContaining({ query: expect.objectContaining({ tags: ['app:horse-tinder-p1-1'] }) }),
        );
    });

    it('refuses csv with the formats it does support', async () => {
        await expect(runs('--format', 'csv')).rejects.toThrow(/Supported formats: json, jsonl/);
        expect(mocks.search).not.toHaveBeenCalled();
    });

    it('filters by --after and --before, which were ignored before', async () => {
        await runs('--after', '2026-11-01', '--before', '2026-11-26T12:00:00Z');
        expect(mocks.search).toHaveBeenCalledWith(
            expect.objectContaining({
                query: expect.objectContaining({ start: '2026-11-01', end: '2026-11-26T12:00:00Z' }),
            }),
        );
    });

    it('refuses a date it cannot read before searching', async () => {
        await expect(runs('--after', 'last tuesday')).rejects.toThrow('--after must be a date in ISO format');
        expect(mocks.search).not.toHaveBeenCalled();
    });

    it('refuses --inference-profile, which never filtered anything', async () => {
        await expect(runs('--inference-profile', 'p1')).rejects.toThrow(/cannot filter by inference profile/);
        expect(mocks.search).not.toHaveBeenCalled();
    });

    it('refuses -q, which the server ignored, and says what to use instead', async () => {
        await expect(runs('-q', 'horse-tinder-p1-1')).rejects.toThrow(/Use --app <name> or --tags/);
        expect(mocks.search).not.toHaveBeenCalled();
    });
});
