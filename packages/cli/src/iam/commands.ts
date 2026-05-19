import { AccessControlPrincipalType, AccessControlResourceType, ProjectRoles } from '@vertesia/common';
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

/**
 * Parse a comma-separated patterns option (e.g. "ui:studio,tool:create_*") into
 * a string array. Trims whitespace and filters out empty entries.
 */
function parsePatterns(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const list = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return list.length > 0 ? list : undefined;
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
    // Shortcut: --patterns "ui:studio,tool:create_*" → conditions.resource_props.patterns
    const patterns = parsePatterns(options.patterns);
    if (patterns) {
        conditions.resource_props = { ...(conditions.resource_props ?? {}), patterns };
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

/**
 * Create a contribution_set denial ACE (role='none').
 *
 * Pre-fills resource_type='contribution_set' and role='none' so callers only
 * need to provide the principal and patterns. Patterns are passed as a
 * comma-separated list (e.g. "ui:studio,tool:create_*").
 */
export async function createDenial(program: Command, options: Record<string, any>) {
    const client = await getClient(program);

    const patterns = parsePatterns(options.patterns);
    if (!patterns || patterns.length === 0) {
        console.error(`${colors.red('✗')} --patterns is required (e.g. "ui:studio,tool:create_*")`);
        process.exit(1);
    }

    const conditions: Record<string, any> = {
        resource_props: { patterns },
    };
    if (options.principalProps) {
        conditions.principal_props = JSON.parse(options.principalProps);
    }

    const ace = await client.iam.aces.create({
        principal: options.principal,
        principal_type: options.principalType as AccessControlPrincipalType,
        resource: options.resourceName ?? 'Denial Rule',
        resource_type: AccessControlResourceType.contribution_set,
        role: ProjectRoles.none,
        conditions,
    });

    console.log(`${colors.green('✓')} Denial rule created: ${ace.id}`);
    console.log(colors.gray(`  ${patterns.length} pattern(s): ${patterns.join(', ')}`));
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
