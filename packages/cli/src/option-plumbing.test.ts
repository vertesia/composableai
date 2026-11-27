import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Parse real argv through the registered commands, so a flag whose name differs from what the handler reads fails.
const client = vi.hoisted(() => ({
    objects: { startExport: vi.fn(), create: vi.fn() },
    types: { list: vi.fn() },
    workflows: { execute: vi.fn() },
}));
vi.mock('./client.js', () => ({ getClient: async () => client }));

const { registerExportCommand } = await import('./export/index.js');
const { registerObjectsCommand } = await import('./objects/index.js');
const { registerWorkflowsCommand } = await import('./workflows/index.js');

function run(register: (program: Command) => void, args: string[]) {
    const program = new Command().exitOverride();
    register(program);
    return program.parseAsync(['node', 'vertesia', ...args]);
}

let dir: string;
beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    dir = await mkdtemp(join(tmpdir(), 'cli-options-test-'));
});
afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
});

describe('export', () => {
    it.each([
        [[], false],
        [['--include-metadata'], true],
    ])('honours %o for metadata', async (flags, metadata) => {
        client.objects.startExport.mockRejectedValue(Object.assign(new Error('stop'), { status: 429 }));
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        await run(registerExportCommand, ['export', ...flags]);
        expect(client.objects.startExport.mock.calls[0][0].include.metadata).toBe(metadata);
    });
});

describe('workflows execute', () => {
    beforeEach(() => {
        client.workflows.execute.mockResolvedValue([{ workflow_id: 'w', run_id: 'r' }]);
    });

    it('keeps the task queue, vars and objects of the payload file', async () => {
        const file = join(dir, 'payload.json');
        await writeFile(file, JSON.stringify({ task_queue: 'q', vars: { a: 1 }, objectIds: ['o1'] }));
        await run(registerWorkflowsCommand, ['workflows', 'execute', 'wf', '-f', file]);
        expect(client.workflows.execute).toHaveBeenCalledWith(
            'wf',
            expect.objectContaining({ task_queue: 'q', vars: { a: 1 }, objectIds: ['o1'] }),
        );
    });

    it('lets explicit flags win over the payload file', async () => {
        const file = join(dir, 'payload.json');
        await writeFile(file, JSON.stringify({ task_queue: 'q', vars: { a: 1 }, objectIds: ['o1'] }));
        await run(registerWorkflowsCommand, [
            'workflows',
            'execute',
            'wf',
            '-f',
            file,
            '--queue',
            'other',
            '-v',
            '{"b":2}',
            '-o',
            'o2',
        ]);
        expect(client.workflows.execute).toHaveBeenCalledWith(
            'wf',
            expect.objectContaining({ task_queue: 'other', vars: { b: 2 }, objectIds: ['o2'] }),
        );
    });

    it('keeps the objects of the payload file when -o has no value', async () => {
        const file = join(dir, 'payload.json');
        await writeFile(file, JSON.stringify({ objectIds: ['o1'] }));
        await run(registerWorkflowsCommand, ['workflows', 'execute', 'wf', '-f', file, '-o']);
        expect(client.workflows.execute).toHaveBeenCalledWith('wf', expect.objectContaining({ objectIds: ['o1'] }));
    });

    it('defaults the task queue without a file', async () => {
        await run(registerWorkflowsCommand, ['workflows', 'execute', 'wf']);
        expect(client.workflows.execute).toHaveBeenCalledWith(
            'wf',
            expect.objectContaining({ task_queue: 'zeno-content', vars: {} }),
        );
    });
});

describe('content post', () => {
    beforeEach(() => {
        client.types.list.mockResolvedValue([{ id: 'type-id', name: 'Invoice' }]);
        client.objects.create.mockResolvedValue({ id: 'created' });
    });

    it.each([
        ['Invoice', 'type-id'],
        ['type-id', 'type-id'],
        ['auto', undefined],
    ])('resolves --type %s for a file', async (type, expected) => {
        const file = join(dir, 'doc.txt');
        await writeFile(file, 'hello');
        await run(registerObjectsCommand, ['content', 'post', file, '--type', type]);
        expect(client.objects.create).toHaveBeenCalledWith(expect.objectContaining({ type: expected }));
    });

    it('uses --type for a directory without prompting', async () => {
        await writeFile(join(dir, 'a.txt'), 'a');
        await run(registerObjectsCommand, ['content', 'post', dir, '--type', 'Invoice']);
        expect(client.objects.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'type-id' }));
    });

    it('infers the content type when --mime has no value', async () => {
        const file = join(dir, 'doc.txt');
        await writeFile(file, 'hello');
        await run(registerObjectsCommand, ['content', 'post', file, '--type', 'auto', '--mime']);
        expect(client.objects.create.mock.calls[0][0].content.type).toBe('text/plain');
    });

    it('sends --mime as the content type', async () => {
        const file = join(dir, 'doc.txt');
        await writeFile(file, 'hello');
        await run(registerObjectsCommand, ['content', 'post', file, '--type', 'auto', '--mime', 'text/markdown']);
        expect(client.objects.create.mock.calls[0][0].content.type).toBe('text/markdown');
    });
});
