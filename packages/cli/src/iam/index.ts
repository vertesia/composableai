import type { Command } from 'commander';
import { createAce, deleteAce, listAces, listRoles } from './commands.js';

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

    // --- Roles ---

    iam.command('roles')
        .description('List available roles and their permissions')
        .action(async () => {
            await listRoles(program);
        });
}
