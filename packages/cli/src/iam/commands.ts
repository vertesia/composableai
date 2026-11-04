import type {
    AccessControlPrincipalType,
    AccessControlResourceType,
    CreateUserPayload,
    SystemRoles,
} from '@vertesia/common';
import colors from 'ansi-colors';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { type CliOptions, getBooleanOption, getStringOption, isRecord } from '../utils/options.js';

type CreateAceOptions = CliOptions<{
    principal?: string;
    principalType?: AccessControlPrincipalType;
    resource?: string;
    resourceType?: AccessControlResourceType;
    role?: SystemRoles;
    principalProps?: string;
    resourceProps?: string;
}>;

export async function listAces(program: Command, _options: Record<string, unknown>) {
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

export async function createAce(program: Command, options: CreateAceOptions) {
    const client = await getClient(program);

    const conditions: Record<string, unknown> = {};
    const principalProps = getStringOption(options.principalProps);
    const resourceProps = getStringOption(options.resourceProps);
    if (principalProps) {
        conditions.principal_props = JSON.parse(principalProps);
    }
    if (resourceProps) {
        conditions.resource_props = JSON.parse(resourceProps);
    }

    const hasConditions = Object.keys(conditions).length > 0;

    const ace = await client.iam.aces.create({
        principal: requireStringOption(options.principal, '--principal'),
        principal_type: requireEnumOption(options.principalType, '--principal-type'),
        resource: requireStringOption(options.resource, '--resource'),
        resource_type: requireEnumOption(options.resourceType, '--resource-type'),
        role: requireEnumOption(options.role, '--role'),
        conditions: hasConditions ? conditions : undefined,
    });

    console.log(`${colors.green('✓')} ACE created: ${ace.id}`);
}

function requireStringOption(value: unknown, name: string): string {
    const option = getStringOption(value);
    if (!option) {
        console.error(`${colors.red('✗')} ${name} is required`);
        process.exit(1);
    }
    return option;
}

function requireEnumOption<T extends string>(value: T | undefined, name: string): T {
    if (!value) {
        console.error(`${colors.red('✗')} ${name} is required`);
        process.exit(1);
    }
    return value;
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

type CreateUserOptions = CliOptions<{
    name?: string;
    group?: string[];
    properties?: string;
    clearance?: string;
    compartment?: string[];
    json?: boolean;
}>;

export async function createUser(program: Command, email: string, options: CreateUserOptions) {
    const payload: CreateUserPayload = {
        email,
        name: getStringOption(options.name),
        groups: options.group?.length ? options.group : undefined,
        compartments: options.compartment?.length ? options.compartment : undefined,
    };
    const properties = getStringOption(options.properties);
    if (properties) {
        const parsed: unknown = JSON.parse(properties);
        if (!isRecord(parsed)) {
            throw new Error('--properties must be a JSON object');
        }
        payload.properties = parsed;
    }
    const clearance = getStringOption(options.clearance);
    if (clearance) {
        payload.clearance = Number(clearance);
        if (!Number.isFinite(payload.clearance)) {
            throw new Error('--clearance must be a number');
        }
    }

    const client = await getClient(program);
    const user = await client.users.create(payload);
    if (getBooleanOption(options.json)) {
        console.log(JSON.stringify(user, null, 2));
        return;
    }
    console.log(`${colors.green('✓')} User ${user.email} is a member of the account: ${user.id}`);
}
