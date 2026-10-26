import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { readStdin } from '../utils/stdio.js';
import { readJsonInput } from './inputs.js';

/** Credential operations always require installation IDs; never resolve a sibling by app name. */
export function registerAppCredentialsCommands(apps: Command, program: Command) {
    const keys = apps.command('api-key').description('Manage an MCP collection API key for one installation');
    keys.command('status <installationId> <collectionId>')
        .description('Show whether an API key is configured (masked hint only)')
        .action(async (installationId: string, collectionId: string) => {
            const result = await (await getClient(program)).apps.getInstallationMcpApiKeyStatus(
                installationId,
                collectionId,
            );
            console.log(JSON.stringify(result, null, 2));
        });
    keys.command('set <installationId> <collectionId>')
        .description('Store or rotate a write-only API key for this installation')
        .option('--key-file <file>', 'Read the key from a text file')
        .option('--stdin', 'Read the key from standard input')
        .action(
            async (installationId: string, collectionId: string, options: { keyFile?: string; stdin?: boolean }) => {
                if ((options.keyFile !== undefined) === (options.stdin === true)) {
                    throw new Error('Provide exactly one of --key-file or --stdin');
                }
                const key = (
                    options.keyFile !== undefined ? await readFile(options.keyFile, 'utf8') : await readStdin()
                ).trim();
                if (!key) throw new Error('The API key must not be empty');
                await (await getClient(program)).apps.setInstallationMcpApiKey(installationId, collectionId, key);
                console.log('API key saved for this installation.');
            },
        );
    keys.command('delete <installationId> <collectionId>')
        .description('Remove only this installation’s API key')
        .action(async (installationId: string, collectionId: string) => {
            await (await getClient(program)).apps.deleteInstallationMcpApiKey(installationId, collectionId);
            console.log('API key removed from this installation.');
        });

    const connections = apps.command('connections').description('Manage installation-scoped MCP OAuth connections');
    connections
        .command('status <installationId> [collectionId]')
        .description('Show OAuth connection status without retrieving tokens')
        .action(async (installationId: string, collectionId?: string) => {
            const api = (await getClient(program)).remoteMcpConnections;
            const result =
                collectionId === undefined
                    ? await api.getStatus(installationId)
                    : await api.getCollectionStatus(installationId, collectionId);
            console.log(JSON.stringify(result, null, 2));
        });
    connections
        .command('authorize <installationId> <collectionId>')
        .description('Print an authorization URL for an interactive OAuth connection')
        .action(async (installationId: string, collectionId: string) => {
            const result = await (await getClient(program)).remoteMcpConnections.authorize(
                installationId,
                collectionId,
            );
            console.log(JSON.stringify(result, null, 2));
        });
    connections
        .command('exchange')
        .description('Complete authorization using the code and state from the OAuth callback')
        .requiredOption('--response-file <file>', 'JSON file with code and state from the callback')
        .action(async (options: { responseFile: string }) => {
            const response = await readJsonInput(undefined, options.responseFile, '--response');
            if (
                !response ||
                Object.keys(response).some((key) => !['code', 'state'].includes(key)) ||
                typeof response.code !== 'string' ||
                !response.code.trim() ||
                typeof response.state !== 'string' ||
                !response.state.trim()
            ) {
                throw new Error('OAuth response must contain nonempty code and state strings');
            }
            const result = await (await getClient(program)).remoteMcpConnections.exchange(
                response.code,
                response.state,
            );
            if (!result.success) throw new Error('OAuth authorization did not succeed');
            console.log('OAuth connection authorized.');
        });
    connections
        .command('connect <installationId> <collectionId>')
        .description('Connect a collection using its configured client_credentials OAuth provider')
        .action(async (installationId: string, collectionId: string) => {
            const result = await (await getClient(program)).remoteMcpConnections.connect(installationId, collectionId);
            if (!result.success) throw new Error('OAuth connection did not succeed');
            console.log('OAuth connection established.');
        });
    connections
        .command('disconnect <installationId> <collectionId>')
        .description('Disconnect only this installation’s OAuth connection')
        .action(async (installationId: string, collectionId: string) => {
            const result = await (await getClient(program)).remoteMcpConnections.disconnect(
                installationId,
                collectionId,
            );
            if (!result.success) throw new Error('OAuth disconnect did not succeed');
            console.log('OAuth connection disconnected.');
        });
}
