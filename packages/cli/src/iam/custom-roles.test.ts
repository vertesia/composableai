import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerCustomRolesCommand } from './custom-roles.js';

const mocks = vi.hoisted(() => ({
    readFile: vi.fn(),
    list: vi.fn(),
    permissions: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}));
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }));
vi.mock('../client.js', () => ({ getClient: async () => ({ account: { roles: mocks } }) }));
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

async function command(...args: string[]) {
    const program = new Command();
    registerCustomRolesCommand(program, program.command('iam'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await program.parseAsync(['iam', 'custom-roles', ...args], { from: 'user' });
}

describe('custom role CLI', () => {
    it('lists definitions and the platform permission catalog', async () => {
        await command('list');
        await command('permissions');
        expect(mocks.list).toHaveBeenCalledOnce();
        expect(mocks.permissions).toHaveBeenCalledOnce();
    });
    it('creates, updates and deletes using unprefixed names', async () => {
        const definition = {
            name: 'reviewer',
            title: 'Reviewer',
            permissions: ['content:read'],
            base_roles: ['auditor', 'c:base'],
        };
        mocks.readFile.mockResolvedValueOnce(JSON.stringify(definition));
        await command('create', 'role.json');
        expect(mocks.create).toHaveBeenCalledWith(definition);
        mocks.readFile.mockResolvedValueOnce(JSON.stringify({ title: 'New Title', base_roles: [] }));
        await command('update', 'reviewer', 'role.json');
        expect(mocks.update).toHaveBeenCalledWith('reviewer', { title: 'New Title', base_roles: [] });
        await command('delete', 'reviewer');
        expect(mocks.delete).toHaveBeenCalledWith('reviewer');
    });
    it('rejects malformed definitions before sending a request', async () => {
        mocks.readFile.mockResolvedValueOnce(JSON.stringify({ name: 'c:reviewer', permissions: [] }));
        await expect(command('create', 'role.json')).rejects.toThrow('Invalid custom role');
        mocks.readFile.mockResolvedValueOnce(JSON.stringify({ permissions: ['unknown:permission'] }));
        await expect(command('update', 'reviewer', 'role.json')).rejects.toThrow('Invalid custom role');
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it('rejects ABAC and malformed bases before sending a request', async () => {
        for (const base of ['content:reader', 'c:not-valid', 'not_a_system_role']) {
            mocks.readFile.mockResolvedValueOnce(JSON.stringify({ base_roles: [base] }));
            await expect(command('update', 'reviewer', 'role.json')).rejects.toThrow('Invalid custom role');
        }
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
