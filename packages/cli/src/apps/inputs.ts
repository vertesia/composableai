import { readFile } from 'node:fs/promises';
import type { AppInstallationPayload } from '@vertesia/common';
import { isRecord } from '../utils/options.js';

type Credentials = Pick<AppInstallationPayload, 'oauth_params' | 'oauth_provider_params' | 'api_key_params'>;
type OAuthParams = NonNullable<AppInstallationPayload['oauth_params']>;

export async function readJsonInput(json: string | undefined, file: string | undefined, label: string) {
    if (json !== undefined && file !== undefined) throw new Error(`Provide either ${label} or ${label}-file`);
    const content = file !== undefined ? await readFile(file, 'utf8') : json;
    if (content === undefined) return undefined;
    let value: unknown;
    try {
        value = JSON.parse(content);
    } catch {
        // JSON parser messages can quote credentials; never include them in CLI errors or causes.
        throw new Error(`${label} must contain valid JSON`);
    }
    if (!isRecord(value)) throw new Error(`${label} must contain a JSON object`);
    return value;
}

export function stringMap(
    value: Record<string, unknown> | undefined,
    label: string,
): Record<string, string> | undefined {
    if (value === undefined) return undefined;
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (typeof item !== 'string') throw new Error(`${label} must map keys to strings`);
            return [key, item];
        }),
    );
}

export function parameterMap(value: Record<string, unknown> | undefined): Record<string, string | null> | undefined {
    if (value === undefined) return undefined;
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (item !== null && typeof item !== 'string') throw new Error('MCP parameters must be strings or null');
            return [key, item];
        }),
    );
}

export function collectionParameters(
    value: Record<string, unknown> | undefined,
): AppInstallationPayload['mcp_parameters'] {
    if (value === undefined) return undefined;
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (!isRecord(item)) throw new Error('MCP collection parameters must map collection IDs to objects');
            return [key, parameterMap(item) ?? {}];
        }),
    );
}

function oauthParams(value: unknown): OAuthParams | undefined {
    if (value === undefined) return undefined;
    if (!isRecord(value)) throw new Error('OAuth credentials must map collection or provider IDs to objects');
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (
                !isRecord(item) ||
                Object.keys(item).some((field) => !['client_id', 'client_secret', 'scopes'].includes(field))
            ) {
                throw new Error('OAuth credentials only accept client_id, client_secret and scopes');
            }
            const { client_id, client_secret, scopes } = item;
            if (
                (client_id !== undefined && typeof client_id !== 'string') ||
                (client_secret !== undefined && typeof client_secret !== 'string') ||
                (scopes !== undefined && (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== 'string')))
            ) {
                throw new Error('OAuth credentials require string client IDs/secrets and an array of string scopes');
            }
            return [
                key,
                {
                    ...(client_id !== undefined ? { client_id } : {}),
                    ...(client_secret !== undefined ? { client_secret } : {}),
                    ...(scopes !== undefined ? { scopes: scopes as string[] } : {}),
                },
            ];
        }),
    );
}

export async function readCredentials(file: string | undefined): Promise<Credentials> {
    const input = await readJsonInput(undefined, file, '--credentials');
    if (input === undefined) return {};
    if (Object.keys(input).some((key) => !['oauth_params', 'oauth_provider_params', 'api_key_params'].includes(key))) {
        throw new Error('Credentials only accept oauth_params, oauth_provider_params and api_key_params');
    }
    let api_key_params: AppInstallationPayload['api_key_params'];
    if (input.api_key_params !== undefined) {
        if (!isRecord(input.api_key_params)) throw new Error('API keys must map collection IDs to credential objects');
        api_key_params = Object.fromEntries(
            Object.entries(input.api_key_params).map(([key, item]) => {
                if (
                    !isRecord(item) ||
                    Object.keys(item).some((field) => field !== 'api_key') ||
                    typeof item.api_key !== 'string' ||
                    !item.api_key.trim()
                ) {
                    throw new Error('Each API key credential must contain a nonempty api_key string');
                }
                return [key, { api_key: item.api_key }];
            }),
        );
    }
    return {
        oauth_params: oauthParams(input.oauth_params),
        oauth_provider_params: oauthParams(input.oauth_provider_params),
        api_key_params,
    };
}
