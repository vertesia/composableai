import { readFile } from 'node:fs/promises';
import { validateApiRequest } from '@vertesia/common/api-contract';
import type { Command } from 'commander';
import { getClient } from '../client.js';

export function registerCustomRolesCommand(program: Command, iam: Command): void {
    const roles = iam.command('custom-roles').description('Manage custom roles in the current account');
    roles.command('list').action(async () => {
        const client = await getClient(program);
        console.log(JSON.stringify(await client.account.roles.list(), null, 2));
    });
    roles.command('permissions').action(async () => {
        const client = await getClient(program);
        console.log(JSON.stringify(await client.account.roles.permissions(), null, 2));
    });
    roles
        .command('create <file>')
        .description('Create a role from a JSON file')
        .action(async (file: string) => {
            const result = validateApiRequest('CreateCustomRolePayload', JSON.parse(await readFile(file, 'utf8')));
            if (!result.valid) throw new Error('Invalid custom role definition');
            const client = await getClient(program);
            console.log(JSON.stringify(await client.account.roles.create(result.data), null, 2));
        });
    roles
        .command('update <name> <file>')
        .description('Update a role from a JSON file; names are immutable')
        .action(async (name: string, file: string) => {
            const result = validateApiRequest('UpdateCustomRolePayload', JSON.parse(await readFile(file, 'utf8')));
            if (!result.valid) throw new Error('Invalid custom role update');
            const client = await getClient(program);
            console.log(JSON.stringify(await client.account.roles.update(name, result.data), null, 2));
        });
    roles
        .command('delete <name>')
        .description('Delete an unassigned custom role')
        .action(async (name: string) => {
            const client = await getClient(program);
            console.log(JSON.stringify(await client.account.roles.delete(name), null, 2));
        });
}
