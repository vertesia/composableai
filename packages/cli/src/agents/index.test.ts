import type { WorkflowRunWithDetails } from '@vertesia/common';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAgentsCommand } from './index.js';

const mocks = vi.hoisted(() => ({ retrieveRun: vi.fn(), getRunDetails: vi.fn(), writeFile: vi.fn() }));
vi.mock('../client.js', () => ({ getClient: async () => ({ agents: mocks }) }));
vi.mock('../utils/stdio.js', () => ({ writeFile: mocks.writeFile, readFile: vi.fn(), readStdin: vi.fn() }));

const details = (mode: 'snapshot' | 'delta', next = 'next'): WorkflowRunWithDetails => ({
    started_at: null,
    closed_at: null,
    history: { type: 'agent', mode, next_from: next, agentTasks: [] },
});
async function inspect(...options: string[]) {
    const program = new Command().exitOverride();
    registerAgentsCommand(program);
    await program.parseAsync(['agents', 'inspect', 'run-1', ...options], { from: 'user' });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.retrieveRun.mockResolvedValue({ id: 'run-1', run_kind: 'agent' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('agents inspect history cursors', () => {
    it('preserves the initial snapshot and next cursor in JSON output', async () => {
        const snapshot = details('snapshot');
        mocks.getRunDetails.mockResolvedValue(snapshot);
        await inspect('--details', '--json');
        expect(mocks.getRunDetails).toHaveBeenCalledWith('run-1', { includeHistory: true, from: undefined });
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({
            run: { id: 'run-1', run_kind: 'agent' },
            details: snapshot,
        });
    });

    it('forwards an opaque cursor unchanged and implies details and JSON output', async () => {
        const delta = details('delta');
        mocks.getRunDetails.mockResolvedValue(delta);
        await inspect('--from', 'opaque/+==');
        expect(mocks.getRunDetails).toHaveBeenCalledExactlyOnceWith('run-1', {
            includeHistory: true,
            from: 'opaque/+==',
        });
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0]).details).toEqual(delta);
    });

    it('writes snapshot fallback unchanged to a file without stdout', async () => {
        const snapshot = details('snapshot');
        mocks.getRunDetails.mockResolvedValue(snapshot);
        await inspect('--from', 'expired', '--output', 'history.json');
        expect(JSON.parse(mocks.writeFile.mock.calls[0][1]).details).toEqual(snapshot);
        expect(mocks.writeFile.mock.calls[0][0]).toBe('history.json');
        expect(console.log).not.toHaveBeenCalled();
    });

    it('does not remember cursors or merge responses between invocations', async () => {
        mocks.getRunDetails.mockResolvedValueOnce(details('delta')).mockResolvedValueOnce(details('snapshot'));
        await inspect('--from', 'previous');
        await inspect('--details', '--json');
        expect(mocks.getRunDetails.mock.calls[1]).toEqual(['run-1', { includeHistory: true, from: undefined }]);
        expect(JSON.parse(vi.mocked(console.log).mock.calls[1][0]).details).toEqual(details('snapshot'));
    });
});
