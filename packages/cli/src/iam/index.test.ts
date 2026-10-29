import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerIamCommand } from './index.js';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../client.js', () => ({
    getClient: async () => ({ users: { create: mocks.create } }),
}));
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});
async function command(...args: string[]) {
    const program = new Command();
    registerIamCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await program.parseAsync(['iam', ...args], { from: 'user' });
}
describe('iam users CLI', () => {
    it('forwards the address, groups and authorization attributes', async () => {
        mocks.create.mockResolvedValue({ id: 'u1', email: 'new@acme.com' });
        await command(
            'users',
            'create',
            'new@acme.com',
            '--name',
            'New User',
            '--group',
            'g1',
            'g2',
            '--clearance',
            '3',
            '--compartment',
            'finance',
            '--properties',
            '{"region":"emea"}',
        );
        expect(mocks.create).toHaveBeenCalledWith({
            email: 'new@acme.com',
            name: 'New User',
            groups: ['g1', 'g2'],
            compartments: ['finance'],
            clearance: 3,
            properties: { region: 'emea' },
        });
    });
    it('rejects malformed attributes without calling the API', async () => {
        await expect(command('users', 'create', 'new@acme.com', '--properties', '[1]')).rejects.toThrow(
            '--properties must be a JSON object',
        );
        await expect(command('users', 'create', 'new@acme.com', '--clearance', 'high')).rejects.toThrow(
            '--clearance must be a number',
        );
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it('prints the full user with --json', async () => {
        mocks.create.mockResolvedValue({ id: 'u1', email: 'new@acme.com' });
        await command('users', 'create', 'new@acme.com', '--json');
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({ id: 'u1', email: 'new@acme.com' });
    });
});
