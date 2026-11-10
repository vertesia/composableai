import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerNotificationsCommand } from './index.js';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    retrieve: vi.fn(),
    counts: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    archive: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
}));
vi.mock('../client.js', () => ({
    getClient: async () => ({ store: { notifications: mocks } }),
}));
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});
async function command(...args: string[]) {
    const program = new Command();
    registerNotificationsCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await program.parseAsync(['notifications', ...args], { from: 'user' });
}
describe('notifications CLI', () => {
    it('forwards list filters and rejects invalid ones', async () => {
        mocks.list.mockResolvedValue({ notifications: [], read_all_before: '2026-10-31T00:00:00.000Z' });
        await command('list', '--unread', '--category', 'actions', '--limit', '10');
        expect(mocks.list).toHaveBeenCalledWith({ unread: true, category: 'actions', limit: 10 });
        await expect(command('list', '--category', 'nope')).rejects.toThrow('Invalid category');
        await expect(command('list', '--limit', '0')).rejects.toThrow('Invalid limit');
        expect(mocks.list).toHaveBeenCalledTimes(1);
    });
    it('accepts ids as separate or comma-joined arguments', async () => {
        await command('read', 'a,b', 'c');
        expect(mocks.markRead).toHaveBeenCalledWith({ ids: ['a', 'b', 'c'] });
        await command('archive', 'x');
        expect(mocks.archive).toHaveBeenCalledWith({ ids: ['x'] });
    });
    it('marks all read up to the server boundary', async () => {
        mocks.list.mockResolvedValue({ notifications: [], read_all_before: '2026-10-31T12:00:00.000Z' });
        await command('read-all');
        expect(mocks.markAllRead).toHaveBeenCalledWith({ before: '2026-10-31T12:00:00.000Z' });
    });
    it('fills missing preference maps', async () => {
        await command('preferences', 'set', '{"categories":{"results":{"in_app":false}}}');
        expect(mocks.updatePreferences).toHaveBeenCalledWith({ categories: { results: { in_app: false } }, kinds: {} });
        await expect(command('preferences', 'set', '[]')).rejects.toThrow('Expected a JSON object');
    });
});
