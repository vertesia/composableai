import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerObjectsCommand } from './index.js';

const mocks = vi.hoisted(() => ({ getIntakeCost: vi.fn() }));
vi.mock('../client.js', () => ({
    getClient: async () => ({ objects: mocks }),
}));

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

async function command(...args: string[]) {
    const program = new Command();
    registerObjectsCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await program.parseAsync(['content', ...args], { from: 'user' });
}

const COST = {
    object_id: 'obj',
    run_count: 2,
    cost_usd: 0.0123,
    priced_calls: 5,
    unpriced_calls: 1,
    runs: [
        {
            root_run_id: 'run-2',
            outcome: 'completed',
            content_type_name: 'Invoice',
            started_at: '2026-11-10T12:00:00.000Z',
            last_event_at: '2026-11-10T12:01:00.000Z',
            cost_usd: 0.01,
            priced_calls: 4,
            unpriced_calls: 1,
            failed_calls: 0,
            calls: { inference: 5 },
            tokens: { input: 1000 },
        },
    ],
};

describe('content intake-cost CLI', () => {
    it('prints the total and one line per run', async () => {
        mocks.getIntakeCost.mockResolvedValue(COST);
        await command('intake-cost', 'obj');
        expect(mocks.getIntakeCost).toHaveBeenCalledWith('obj', undefined);
        const lines = vi.mocked(console.log).mock.calls.map((call) => String(call[0]));
        expect(lines[0]).toBe('$0.0123 over 2 intake run(s), 5 priced call(s), 1 unpriced');
        expect(lines[1]).toContain('completed');
        expect(lines[1]).toContain('Invoice');
    });

    it('forwards the limit and prints raw JSON on request', async () => {
        mocks.getIntakeCost.mockResolvedValue(COST);
        await command('intake-cost', 'obj', '--limit', '10', '--json');
        expect(mocks.getIntakeCost).toHaveBeenCalledWith('obj', { limit: 10 });
        expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual(COST);
    });

    it('rejects an invalid limit before calling the API', async () => {
        await expect(command('intake-cost', 'obj', '--limit', '0')).rejects.toThrow('Invalid limit');
        expect(mocks.getIntakeCost).not.toHaveBeenCalled();
    });
});
