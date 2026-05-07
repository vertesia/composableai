import { AccessControlPrincipalType, AccessControlResourceType } from '@vertesia/common';
import { Command } from 'commander';
import colors from 'ansi-colors';
import { getClient } from '../client.js';

export async function listAces(program: Command, _options: Record<string, any>) {
    const client = await getClient(program);
    const aces = await client.iam.aces.listProjectAces();

    if (aces.length === 0) {
        console.log('No access control entries found.');
        return;
    }

    console.log(colors.bold('Principal\tType\tRole\tResource\tResource Type'));
    for (const ace of aces) {
        console.log(`${ace.principal}\t${ace.principal_type}\t${ace.role}\t${ace.resource}\t${ace.resource_type}`);
    }
    console.log(`\n${colors.gray(`${aces.length} entries`)}`);
}

export async function createAce(program: Command, options: Record<string, any>) {
    const client = await getClient(program);

    const conditions: Record<string, any> = {};
    if (options.principalProps) {
        conditions.principal_props = JSON.parse(options.principalProps);
    }
    if (options.resourceProps) {
        conditions.resource_props = JSON.parse(options.resourceProps);
    }

    const hasConditions = Object.keys(conditions).length > 0;

    const ace = await client.iam.aces.create({
        principal: options.principal,
        principal_type: options.principalType as AccessControlPrincipalType,
        resource: options.resource,
        resource_type: options.resourceType as AccessControlResourceType,
        role: options.role,
        conditions: hasConditions ? conditions : undefined,
    });

    console.log(`${colors.green('✓')} ACE created: ${ace.id}`);
}

export async function deleteAce(program: Command, aceId: string) {
    const client = await getClient(program);
    await client.iam.aces.delete(aceId);
    console.log(`${colors.green('✓')} ACE deleted: ${aceId}`);
}

export async function listRoles(program: Command) {
    const client = await getClient(program);
    const roles = await client.iam.roles.list();

    console.log(colors.bold('Role\tPermissions'));
    for (const role of roles) {
        console.log(`${role.name}\t${role.permissions.join(', ')}`);
    }
}
