import { AccessControlPrincipalType, AccessControlResourceType, ProjectRoles } from '@vertesia/common';
import { Command } from 'commander';
import colors from 'ansi-colors';
import { getClient } from '../client.js';
import { getStringOption, type CliOptions } from '../utils/options.js';

type CreateAceOptions = CliOptions<{
    principal?: string;
    principalType?: AccessControlPrincipalType;
    resource?: string;
    resourceType?: AccessControlResourceType;
    role?: ProjectRoles;
    principalProps?: string;
    resourceProps?: string;
    patterns?: string;
}>;

type CreateDenialOptions = CliOptions<{
    principal?: string;
    principalType?: AccessControlPrincipalType;
    patterns?: string;
    resourceName?: string;
    principalProps?: string;
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

/**
 * Parse a comma-separated patterns option (e.g. "ui:studio,tool:create_*") into
 * a string array. Trims whitespace and filters out empty entries.
 */
function parsePatterns(value: unknown): string[] | undefined {
    const str = getStringOption(value);
    if (!str) return undefined;
    const list = str.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return list.length > 0 ? list : undefined;
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
    // Shortcut: --patterns "ui:studio,tool:create_*" → conditions.resource_props.patterns
    const patterns = parsePatterns(options.patterns);
    if (patterns) {
        conditions.resource_props = {
            ...((conditions.resource_props as Record<string, unknown> | undefined) ?? {}),
            patterns,
        };
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

/**
 * Create a contribution_set denial ACE (role='none').
 *
 * Pre-fills resource_type='contribution_set' and role='none' so callers only
 * need to provide the principal and patterns. Patterns are passed as a
 * comma-separated list (e.g. "ui:studio,tool:create_*").
 */
export async function createDenial(program: Command, options: CreateDenialOptions) {
    const client = await getClient(program);

    const patterns = parsePatterns(options.patterns);
    if (!patterns || patterns.length === 0) {
        console.error(`${colors.red('✗')} --patterns is required (e.g. "ui:studio,tool:create_*")`);
        process.exit(1);
    }

    const conditions: Record<string, unknown> = {
        resource_props: { patterns },
    };
    const principalProps = getStringOption(options.principalProps);
    if (principalProps) {
        conditions.principal_props = JSON.parse(principalProps);
    }

    const ace = await client.iam.aces.create({
        principal: requireStringOption(options.principal, '--principal'),
        principal_type: requireEnumOption(options.principalType, '--principal-type'),
        resource: getStringOption(options.resourceName) ?? 'Denial Rule',
        resource_type: AccessControlResourceType.contribution_set,
        role: ProjectRoles.none,
        conditions,
    });

    console.log(`${colors.green('✓')} Denial rule created: ${ace.id}`);
    console.log(colors.gray(`  ${patterns.length} pattern(s): ${patterns.join(', ')}`));
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
