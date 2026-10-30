import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerWorkflowsCommand } from './index.js';

const mocks = vi.hoisted(() => ({ catalog: vi.fn(async () => ({ workflows: [] })) }));
vi.mock('../client.js', () => ({
    getClient: async () => ({
        store: {
            workflows: { getSubscriptionWorkflowCatalog: mocks.catalog },
        },
    }),
}));
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});
describe('workflows catalog CLI', () => {
    it('prints the SDK catalog including schemas and templates with --json', async () => {
        const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const program = new Command();
        registerWorkflowsCommand(program);
        await program.parseAsync(['workflows', 'catalog', '--json'], { from: 'user' });
        expect(mocks.catalog).toHaveBeenCalledOnce();
        expect(JSON.parse(output.mock.calls[0][0])).toEqual({ workflows: [] });
    });
});
