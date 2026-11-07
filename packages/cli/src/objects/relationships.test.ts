import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerRelationshipCommands } from './relationships.js';

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    upsert: vi.fn(),
    find: vi.fn(),
    traverse: vi.fn(),
    reconcile: vi.fn(),
    valueHints: vi.fn(),
}));

vi.mock('../client.js', () => ({ getClient: async () => ({ store: { relationships: mocks } }) }));

async function command(...args: string[]): Promise<void> {
    const root = new Command();
    const content = root.command('content');
    registerRelationshipCommands(content);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await root.parseAsync(['content', 'relationships', ...args], { from: 'user' });
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

describe('content relationships CLI', () => {
    it('forwards JSON and @file create payloads and prints the response with --json', async () => {
        const payload = { source: { kind: 'document', id: 'source' }, target: { kind: 'document', id: 'target' } };
        mocks.create.mockResolvedValue({ id: 'relationship-1', type: 'references' });
        await command('create', JSON.stringify(payload), '--json');
        expect(mocks.create).toHaveBeenCalledWith(payload);
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({
            id: 'relationship-1',
            type: 'references',
        });

        const dir = await mkdtemp(join(tmpdir(), 'relationship-cli-'));
        const path = join(dir, 'payload.json');
        await writeFile(path, JSON.stringify(payload));
        try {
            await command('create', `@${path}`);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
        expect(mocks.create).toHaveBeenCalledTimes(2);
    });

    it('forwards every read and mutation with typed arguments', async () => {
        const relationship = { id: 'relationship-1', type: 'references', revision: 2 };
        mocks.retrieve.mockResolvedValue(relationship);
        mocks.update.mockResolvedValue(relationship);
        mocks.remove.mockResolvedValue(relationship);
        mocks.upsert.mockResolvedValue({ results: [{ idempotency_key: 'key', relationship }] });
        mocks.find.mockResolvedValue({ relationships: [relationship] });
        mocks.traverse.mockResolvedValue({ nodes: [], edges: [relationship] });
        mocks.reconcile.mockResolvedValue({ dry_run: true, results: [] });
        mocks.valueHints.mockResolvedValue({ fields: [] });

        await command('get', 'relationship-1');
        await command('update', 'relationship-1', '{"expected_revision":1}', '--json');
        await command('delete', 'relationship-1', '2');
        await command('upsert', '{"items":[{"idempotency_key":"key","relationship":{}}]}');
        await command('find', '{"endpoints":[{"kind":"document","id":"source"}]}');
        await command('traverse', '{"start":[{"kind":"document","id":"source"}],"steps":[{}]}');
        await command('reconcile', 'source');
        await command('reconcile', 'source', '--apply', '--json');
        await command('value-hints', 'source', '--json');

        expect(mocks.retrieve).toHaveBeenCalledWith('relationship-1');
        expect(mocks.update).toHaveBeenCalledWith('relationship-1', { expected_revision: 1 });
        expect(mocks.remove).toHaveBeenCalledWith('relationship-1', { expected_revision: 2 });
        expect(mocks.upsert).toHaveBeenCalledWith({ items: [{ idempotency_key: 'key', relationship: {} }] });
        expect(mocks.find).toHaveBeenCalledWith({ endpoints: [{ kind: 'document', id: 'source' }] });
        expect(mocks.traverse).toHaveBeenCalledWith({ start: [{ kind: 'document', id: 'source' }], steps: [{}] });
        expect(mocks.reconcile).toHaveBeenNthCalledWith(1, { document_id: 'source', dry_run: true });
        expect(mocks.reconcile).toHaveBeenNthCalledWith(2, { document_id: 'source', dry_run: false });
        expect(mocks.valueHints).toHaveBeenCalledWith({ document_id: 'source' });
    });

    it('rejects malformed input and invalid revisions before calling the client', async () => {
        await expect(command('create', '[]')).rejects.toThrow('Expected a JSON object');
        await expect(command('delete', 'relationship-1', '-1')).rejects.toThrow('non-negative integer');
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
    });
});
