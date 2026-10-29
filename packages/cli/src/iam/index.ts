import type { Command } from 'commander';
import { createAce, createUser, deleteAce, listAces, listRoles } from './commands.js';

export function registerIamCommand(program: Command) {
    const iam = program.command('iam').description('Manage access control entries and roles');

    // --- ACEs ---

    iam.command('list')
        .description('List all access control entries for the current project')
        .action(async (options: Record<string, unknown>) => {
            await listAces(program, options);
        });

    iam.command('create')
        .description('Create an access control entry')
        .requiredOption('--principal <value>', 'Principal ID or display name (for principal_set)')
        .requiredOption('--principal-type <type>', 'Principal type: user, group, apikey, principal_set')
        .requiredOption('--resource <value>', 'Resource ID or display name (for content_set)')
        .requiredOption('--resource-type <type>', 'Resource type: project, account, application, content_set')
        .requiredOption('--role <role>', 'Role: owner, admin, developer, reader, member, etc.')
        .option('--principal-props <json>', 'Principal conditions JSON (for principal_set)')
        .option('--resource-props <json>', 'Resource conditions JSON (for content_set)')
        .action(async (options: Record<string, unknown>) => {
            await createAce(program, options);
        });

    iam.command('delete <aceId>')
        .description('Delete an access control entry')
        .action(async (aceId: string) => {
            await deleteAce(program, aceId);
        });

    // --- Users ---

    const users = iam.command('users').description('Manage the users of the current account');

    users
        .command('create <email>')
        .description(
            'Add a user to the current account with the member role, without sending an invitation. ' +
                'Creates the user when no user has this address.',
        )
        .option('--name <name>', 'Display name; defaults to the address')
        .option('--group <groupId...>', 'Add the user to these groups of the account')
        .option('--properties <json>', 'ABAC properties as a JSON object')
        .option('--clearance <level>', 'ABAC clearance level')
        .option('--compartment <name...>', 'ABAC compartments')
        .option('--json', 'Print the full user')
        .action(async (email: string, options: Record<string, unknown>) => {
            await createUser(program, email, options);
        });

    // --- Roles ---

    iam.command('roles')
        .description('List available roles and their permissions')
        .action(async () => {
            await listRoles(program);
        });
}
