import { Command } from 'commander';
import { listAces, createAce, createDenial, deleteAce, listRoles } from './commands.js';

export function registerIamCommand(program: Command) {
    const iam = program.command('iam')
        .description('Manage access control entries and roles');

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
        .requiredOption('--resource <value>', 'Resource ID or display name (for content_set / contribution_set)')
        .requiredOption('--resource-type <type>', 'Resource type: project, account, application, content_set, contribution_set')
        .requiredOption('--role <role>', "Role: owner, admin, developer, reader, member, 'none' for denials, etc.")
        .option('--principal-props <json>', 'Principal conditions JSON (for principal_set)')
        .option('--resource-props <json>', 'Resource conditions JSON (for content_set)')
        .option('--patterns <list>', 'Comma-separated contribution patterns (for contribution_set). E.g. "ui:studio,tool:create_*,app:slack" (app: hides everything from an app)')
        .action(async (options: Record<string, unknown>) => {
            await createAce(program, options);
        });

    iam.command('deny')
        .description('Create a contribution_set denial rule (shortcut: role=none, resource_type=contribution_set)')
        .requiredOption('--principal <value>', 'Principal ID or display name (for principal_set)')
        .requiredOption('--principal-type <type>', 'Principal type: user, group, apikey, principal_set')
        .requiredOption('--patterns <list>', 'Comma-separated contribution patterns. Kinds: ui:<app>, tool:<app>:<collection>:<tool>, app:<app> (hides everything). E.g. "ui:studio,tool:create_*,app:slack"')
        .option('--resource-name <name>', 'Display name for this denial rule', 'Denial Rule')
        .option('--principal-props <json>', 'Principal conditions JSON (for principal_set)')
        .action(async (options: Record<string, unknown>) => {
            await createDenial(program, options);
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
