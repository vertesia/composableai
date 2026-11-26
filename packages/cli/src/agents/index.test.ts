import type { WorkflowRunWithDetails } from '@vertesia/common';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAgentsCommand } from './index.js';

const mocks = vi.hoisted(() => ({
    start: vi.fn(),
    retrieveRun: vi.fn(),
    getRunDetails: vi.fn(),
    retrieveMessages: vi.fn(),
    getHistory: vi.fn(),
    getContext: vi.fn(),
    tasks: { list: vi.fn(async () => []) },
    sendSignal: vi.fn(),
    writeFile: vi.fn(),
}));
vi.mock('../client.js', () => ({ getClient: async () => ({ agents: mocks, tasks: mocks.tasks }) }));
vi.mock('../utils/stdio.js', () => ({ writeFile: mocks.writeFile, readFile: vi.fn(), readStdin: vi.fn() }));

const details = (mode: 'snapshot' | 'delta', next = 'next'): WorkflowRunWithDetails => ({
    started_at: null,
    closed_at: null,
    history: { type: 'agent', mode, next_from: next, agentTasks: [] },
});
async function inspect(...options: string[]) {
    const program = new Command().exitOverride();
    registerAgentsCommand(program);
    await program.parseAsync(['agents', 'inspect', '0123456789abcdef01234567', ...options], { from: 'user' });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.retrieveRun.mockResolvedValue({ id: '0123456789abcdef01234567', run_kind: 'agent' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('agents inspect run id', () => {
    it('refuses a uuid, which is a Temporal run id, and names the scaffold status command', async () => {
        const program = new Command().exitOverride();
        registerAgentsCommand(program);
        const parse = program.parseAsync(['agents', 'inspect', '01a21321-0e46-72b6-a12c-3369ed6313da'], {
            from: 'user',
        });
        await expect(parse).rejects.toThrow(/apps scaffolds status/);
        expect(mocks.retrieveRun).not.toHaveBeenCalled();
    });

    it('accepts the AgentRun:<id> workflow id that other commands print', async () => {
        const program = new Command().exitOverride();
        registerAgentsCommand(program);
        await program.parseAsync(['agents', 'inspect', 'AgentRun:0123456789abcdef01234567'], { from: 'user' });
        expect(mocks.retrieveRun).toHaveBeenLastCalledWith('0123456789abcdef01234567');
    });
});

describe('agents inspect history cursors', () => {
    it('preserves the initial snapshot and next cursor in JSON output', async () => {
        const snapshot = details('snapshot');
        mocks.getRunDetails.mockResolvedValue(snapshot);
        await inspect('--details', '--json');
        expect(mocks.getRunDetails).toHaveBeenCalledWith('0123456789abcdef01234567', {
            includeHistory: true,
            hydratePayloads: true,
            from: undefined,
        });
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({
            run: { id: '0123456789abcdef01234567', run_kind: 'agent' },
            details: snapshot,
        });
    });

    it('forwards an opaque cursor unchanged and implies details and JSON output', async () => {
        const delta = details('delta');
        mocks.getRunDetails.mockResolvedValue(delta);
        await inspect('--from', 'opaque/+==');
        expect(mocks.getRunDetails).toHaveBeenCalledExactlyOnceWith('0123456789abcdef01234567', {
            includeHistory: true,
            hydratePayloads: true,
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
        expect(mocks.getRunDetails.mock.calls[1]).toEqual([
            '0123456789abcdef01234567',
            { includeHistory: true, hydratePayloads: true, from: undefined },
        ]);
        expect(JSON.parse(vi.mocked(console.log).mock.calls[1][0]).details).toEqual(details('snapshot'));
    });
});

it('passes the runtime inference profile to agent and process starts', async () => {
    mocks.start.mockResolvedValue({ id: '0123456789abcdef01234567' });
    for (const target of [['sys:GeneralAgent'], ['--process-id', 'process-1']]) {
        const program = new Command().exitOverride();
        registerAgentsCommand(program);
        await program.parseAsync(
            ['agents', 'start', ...target, '--inference-profile', '0123456789abcdef01234567', '--no-stream', '--json'],
            { from: 'user' },
        );
    }
    expect(mocks.start).toHaveBeenCalledTimes(2);
    for (const [payload] of mocks.start.mock.calls) {
        expect(payload.config.inference_profile).toBe('0123456789abcdef01234567');
    }
});

describe('agents inspect process failure', () => {
    it('prints the failed node and its reason in the process summary', async () => {
        mocks.retrieveRun.mockResolvedValue({
            id: '0123456789abcdef01234567',
            run_kind: 'process',
            run_type: 'programmatic',
            status: 'failed',
            process_definition_snapshot: { process: 'app-development-managed' },
            process_state: {
                current_node: 'designer',
                sequence: 8,
                node_history: [
                    { node: 'architect', status: 'completed', context_diff: {}, entered_at: '2026-11-25T15:57:00Z' },
                    {
                        node: 'designer',
                        status: 'failed',
                        context_diff: { error: 'Agent node "designer" produced no parseable output.' },
                        entered_at: '2026-11-25T15:58:02Z',
                    },
                ],
            },
        });
        mocks.getHistory.mockResolvedValue({
            run_id: '0123456789abcdef01234567',
            current_node: 'designer',
            node_history: [],
        });
        mocks.getContext.mockResolvedValue({
            run_id: '0123456789abcdef01234567',
            current_node: 'designer',
            context: {},
        });
        await inspect();
        const printed = vi
            .mocked(console.log)
            .mock.calls.map((call) => String(call[0]))
            .join('\n');
        expect(printed).toContain('failed_node: designer');
        expect(printed).toContain('error: Agent node "designer" produced no parseable output.');
    });
});

describe('agents message and inspect output', () => {
    it('says where the reply appears after a message is sent', async () => {
        mocks.sendSignal.mockResolvedValue({ message: 'Signal UserInput sent' });
        const program = new Command().exitOverride();
        registerAgentsCommand(program);
        await program.parseAsync(['agents', 'message', '0123456789abcdef01234567', 'how is it going'], {
            from: 'user',
        });
        const printed = vi
            .mocked(console.log)
            .mock.calls.map((call) => String(call[0]))
            .join('\n');
        expect(printed).toContain('Signal UserInput sent');
        expect(printed).toContain('agents stream 0123456789abcdef01234567');
    });

    it('keeps message --json output to the raw response only', async () => {
        mocks.sendSignal.mockResolvedValue({ message: 'Signal UserInput sent' });
        const program = new Command().exitOverride();
        registerAgentsCommand(program);
        await program.parseAsync(['agents', 'message', '0123456789abcdef01234567', 'hi', '--json'], { from: 'user' });
        const printed = vi
            .mocked(console.log)
            .mock.calls.map((call) => String(call[0]))
            .join('\n');
        expect(printed).not.toContain('agents stream');
        expect(JSON.parse(printed)).toEqual({ message: 'Signal UserInput sent' });
    });

    it('prints the stored messages in human output when --messages is given', async () => {
        mocks.retrieveMessages.mockResolvedValue([
            { type: 1, timestamp: '2026-11-25T15:00:00.000Z', message: 'Still building the scores table' },
        ]);
        await inspect('--messages');
        const printed = vi
            .mocked(console.log)
            .mock.calls.map((call) => String(call[0]))
            .join('\n');
        expect(mocks.retrieveMessages).toHaveBeenCalledWith('0123456789abcdef01234567');
        expect(printed).toContain('Still building the scores table');
    });
});
