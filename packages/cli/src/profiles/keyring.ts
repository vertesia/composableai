import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
import type { Profile } from './index.js';

const require = createRequire(import.meta.url);

const KEYRING_SERVICE = 'vertesia';
const AUTH_BUNDLE_VERSION = 1;
const KEYRING_UNAVAILABLE_MESSAGE =
    'A native credential store is required for Vertesia CLI profile authentication. Use the signed Vertesia CLI binary.';

interface NativeSecrets {
    get(options: { service: string; name: string }): Promise<string | null>;
    set(options: { service: string; name: string; value: string }): Promise<void>;
    delete(options: { service: string; name: string }): Promise<boolean>;
}

interface KeyringModule {
    Entry: new (
        service: string,
        account: string,
    ) => {
        getPassword(): string | null;
        setPassword(password: string): void;
        deletePassword(): void;
    };
}

export interface StoredAuthBundle {
    version: number;
    accessToken?: string;
    accessTokenExpiresAt?: number;
    idToken?: string;
    refreshToken?: string;
    refreshTokenExpiresAt?: number;
    oauthClientId?: string;
    oauthResource?: string;
}

type WritableAuthBundle = Omit<StoredAuthBundle, 'version'>;

let cachedFallbackSecrets: NativeSecrets | null | undefined;

function getBunSecrets(): NativeSecrets | undefined {
    const runtime = globalThis as typeof globalThis & {
        Bun?: { secrets?: NativeSecrets };
    };
    return runtime.Bun?.secrets;
}

function getFallbackSecrets(): NativeSecrets | undefined {
    if (cachedFallbackSecrets !== undefined) {
        return cachedFallbackSecrets ?? undefined;
    }
    try {
        const { Entry } = require('@napi-rs/keyring') as KeyringModule;
        cachedFallbackSecrets = {
            async get({ service, name }) {
                try {
                    return new Entry(service, name).getPassword();
                } catch (error: unknown) {
                    if (isMissingSecretError(error)) {
                        return null;
                    }
                    throw error;
                }
            },
            async set({ service, name, value }) {
                new Entry(service, name).setPassword(value);
            },
            async delete({ service, name }) {
                try {
                    new Entry(service, name).deletePassword();
                    return true;
                } catch (error: unknown) {
                    if (isMissingSecretError(error)) {
                        return false;
                    }
                    throw error;
                }
            },
        };
    } catch {
        cachedFallbackSecrets = null;
    }
    return cachedFallbackSecrets ?? undefined;
}

function getSecrets(): NativeSecrets | undefined {
    return getBunSecrets() ?? getFallbackSecrets();
}

function isMissingSecretError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('not found') || message.includes('No such') || message.includes('not exist');
}

function requireSecrets(): NativeSecrets {
    const secrets = getSecrets();
    if (!secrets) {
        throw new Error(KEYRING_UNAVAILABLE_MESSAGE);
    }
    return secrets;
}

export function isKeyringAvailable(): boolean {
    return Boolean(getSecrets());
}

async function readRaw(profileName: string): Promise<string | null> {
    const secrets = getSecrets();
    if (!secrets) {
        return null;
    }
    return secrets.get({ service: KEYRING_SERVICE, name: profileName });
}

export async function readAuthBundle(profileName: string): Promise<StoredAuthBundle | undefined> {
    const raw = await readRaw(profileName);
    if (!raw) {
        return undefined;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Invalid keyring payload for profile "${profileName}"`);
    }

    const bundle = parsed as StoredAuthBundle;
    if (bundle.version !== AUTH_BUNDLE_VERSION) {
        throw new Error(`Unsupported auth bundle version for profile "${profileName}"`);
    }
    return bundle;
}

export async function writeAuthBundle(profileName: string, bundle: WritableAuthBundle): Promise<void> {
    const payload: StoredAuthBundle = {
        version: AUTH_BUNDLE_VERSION,
        accessToken: bundle.accessToken,
        accessTokenExpiresAt: bundle.accessTokenExpiresAt,
        idToken: bundle.idToken,
        refreshToken: bundle.refreshToken,
        refreshTokenExpiresAt: bundle.refreshTokenExpiresAt,
        oauthClientId: bundle.oauthClientId,
        oauthResource: bundle.oauthResource,
    };
    await requireSecrets().set({
        service: KEYRING_SERVICE,
        name: profileName,
        value: JSON.stringify(payload),
    });
}

export async function deleteAuthBundle(profileName: string): Promise<void> {
    const secrets = getSecrets();
    if (!secrets) {
        return;
    }
    await secrets.delete({ service: KEYRING_SERVICE, name: profileName });
}

export async function readProfileAccessToken(profile: Pick<Profile, 'name' | 'apikey'>): Promise<string | undefined> {
    const bundle = await readAuthBundle(profile.name);
    return bundle?.accessToken || profile.apikey;
}

export async function readProfileRefreshToken(profileName: string): Promise<string | undefined> {
    return (await readAuthBundle(profileName))?.refreshToken;
}

export function getAccessTokenExpiry(token: string | undefined): number | undefined {
    if (!token) {
        return undefined;
    }
    const decoded = jwt.decode(token, { json: true });
    if (!decoded?.exp) {
        return undefined;
    }
    return decoded.exp * 1000;
}

export async function hasStoredAccessToken(profileName: string): Promise<boolean> {
    return Boolean((await readAuthBundle(profileName))?.accessToken);
}

export async function hasStoredRefreshToken(profileName: string): Promise<boolean> {
    return Boolean((await readAuthBundle(profileName))?.refreshToken);
}
