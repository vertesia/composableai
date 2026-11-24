import type { Command } from 'commander';
import { getClient } from '../client.js';

function print(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}

export function registerSharePointOnboardingCommand(program: Command) {
    const command = program
        .command('sharepoint-onboarding')
        .description('Link a Microsoft organization and review its SharePoint library requests. All output is JSON.');

    command
        .command('begin-organization-link <tenant-id>')
        .description('Create a short-lived link code for a Microsoft Entra administrator')
        .action(async (tenantId: string) => {
            print(await (await getClient(program)).sharepointOnboarding.beginOrganizationLink({ tenant_id: tenantId }));
        });
    command
        .command('list-organizations')
        .action(async () => print(await (await getClient(program)).sharepointOnboarding.listOrganizations()));
    command
        .command('get-organization <tenant-id>')
        .action(async (tenantId: string) =>
            print(await (await getClient(program)).sharepointOnboarding.getOrganization(tenantId)),
        );
    command
        .command('configure-organization-reader <tenant-id> <client-id>')
        .description('Link the organization reader app and return the Microsoft Entra federated credential settings')
        .action(async (tenantId: string, clientId: string) => {
            const { sharepointOnboarding } = await getClient(program);
            print(await sharepointOnboarding.configureOrganizationReader(tenantId, { client_id: clientId }));
        });
    command
        .command('remove-organization-reader <tenant-id>')
        .description('Remove the linked workload reader for this organization')
        .option('--yes', 'Confirm removal of the organization reader')
        .action(async (tenantId: string, { yes }: { yes?: boolean }) => {
            if (!yes) throw new Error('Use --yes to confirm removing the organization reader');
            const { sharepointOnboarding } = await getClient(program);
            print(await sharepointOnboarding.removeOrganizationReader(tenantId));
        });
    command
        .command('list-requests')
        .option('--cursor <id>', 'Next-page cursor from the previous response')
        .action(async (options: { cursor?: string }) => {
            print(
                await (await getClient(program)).sharepointOnboarding.listLibraryRequests({ cursor: options.cursor }),
            );
        });
    command
        .command('get-request <id>')
        .action(async (id: string) =>
            print(await (await getClient(program)).sharepointOnboarding.getLibraryRequest(id)),
        );
    command
        .command('refresh-request <id>')
        .action(async (id: string) =>
            print(await (await getClient(program)).sharepointOnboarding.refreshLibraryRequest(id)),
        );
    command
        .command('open-request <id>')
        .description('Resolve a library receipt to its project using your Vertesia project access')
        .action(async (id: string) =>
            print(await (await getClient(program)).sharepointOnboarding.resolveRequestProject(id)),
        );
}
