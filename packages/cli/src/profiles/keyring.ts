import jwt from 'jsonwebtoken';
import { createRequire } from 'node:module';
import type { Profile } from './index.js';

const require = createRequire(import.meta.url);

const KEYRING_SERVICE = 'vertesia-cli';
const BUN_SECRETS_SERVICE = 'com.vertesia.cli.auth.v1';
const AUTH_BUNDLE_VERSION = 1;
const KEYRING_UNAVAILABLE_MESSAGE = 'Native keyring is required for Vertesia CLI profile authentication.';

interface KeyringModule {
    Entry: new (service: string, account: string) => {
        getPassword(): string | null;
        setPassword(password: string): void;
        deletePassword(): void;
    };
}

interface BunSecrets {
    get(service: string, name: string): Promise<string | null>;
    set(service: string, name: string, value: string): Promise<void>;
    delete(options: { service: string; name: string }): Promise<boolean>;
}

interface BunRuntime {
    secrets?: BunSecrets;
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

export type WritableAuthBundle = Omit<StoredAuthBundle, 'version'>;

export interface AuthBundleWriteResult {
    stored: boolean;
    error?: unknown;
}

let cachedKeyringModule: KeyringModule | null | undefined;
let bunSecretsDisabled = false;

function getKeyringModule(): KeyringModule | undefined {
    if (cachedKeyringModule !== undefined) {
        return cachedKeyringModule ?? undefined;
    }
    try {
        cachedKeyringModule = require('@napi-rs/keyring') as KeyringModule;
    } catch {
        cachedKeyringModule = null;
    }
    return cachedKeyringModule ?? undefined;
}

function getBunSecrets(): BunSecrets | undefined {
    if (bunSecretsDisabled) {
        return undefined;
    }
    const bun = Reflect.get(globalThis, 'Bun') as BunRuntime | undefined;
    return bun?.secrets;
}

export function isKeyringAvailable(): boolean {
    return !!getBunSecrets() || !!getKeyringModule();
}

export function isSyncKeyringAvailable(): boolean {
    return !!getKeyringModule();
}

function getEntry(profileName: string) {
    const keyring = getKeyringModule();
    if (!keyring) {
        throw new Error(KEYRING_UNAVAILABLE_MESSAGE);
    }
    return new keyring.Entry(KEYRING_SERVICE, profileName);
}

async function readRaw(profileName: string): Promise<string | null> {
    const bunSecrets = getBunSecrets();
    if (bunSecrets) {
        try {
            return await bunSecrets.get(BUN_SECRETS_SERVICE, profileName);
        } catch (error) {
            disableBunSecrets(error);
        }
    }
    return readRawSync(profileName);
}

function readRawSync(profileName: string): string | null {
    if (!isSyncKeyringAvailable()) {
        return null;
    }
    try {
        return getEntry(profileName).getPassword();
    } catch (error) {
        if (isNotFoundError(error)) {
            return null;
        }
        if (isCredentialStoreUnavailableError(error)) {
            return null;
        }
        throw error;
    }
}

export async function readAuthBundle(profileName: string): Promise<StoredAuthBundle | undefined> {
    const raw = await readRaw(profileName);
    return parseAuthBundle(profileName, raw);
}

export function readAuthBundleSync(profileName: string): StoredAuthBundle | undefined {
    const raw = readRawSync(profileName);
    return parseAuthBundle(profileName, raw);
}

function parseAuthBundle(profileName: string, raw: string | null): StoredAuthBundle | undefined {
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
    const payload = createAuthBundlePayload(bundle);
    const bunSecrets = getBunSecrets();
    if (bunSecrets) {
        try {
            await bunSecrets.set(BUN_SECRETS_SERVICE, profileName, JSON.stringify(payload));
            return;
        } catch (error) {
            disableBunSecrets(error);
        }
    }
    writeAuthBundleSync(profileName, bundle);
}

export async function tryWriteAuthBundle(
    profileName: string,
    bundle: WritableAuthBundle,
): Promise<AuthBundleWriteResult> {
    try {
        await writeAuthBundle(profileName, bundle);
        return { stored: true };
    } catch (error) {
        return { stored: false, error };
    }
}

export function writeAuthBundleSync(profileName: string, bundle: WritableAuthBundle): void {
    getEntry(profileName).setPassword(JSON.stringify(createAuthBundlePayload(bundle)));
}

function createAuthBundlePayload(bundle: WritableAuthBundle): StoredAuthBundle {
    return {
        version: AUTH_BUNDLE_VERSION,
        accessToken: bundle.accessToken,
        accessTokenExpiresAt: bundle.accessTokenExpiresAt,
        idToken: bundle.idToken,
        refreshToken: bundle.refreshToken,
        refreshTokenExpiresAt: bundle.refreshTokenExpiresAt,
        oauthClientId: bundle.oauthClientId,
        oauthResource: bundle.oauthResource,
    };
}

export async function deleteAuthBundle(profileName: string): Promise<void> {
    const bunSecrets = getBunSecrets();
    if (bunSecrets) {
        try {
            await bunSecrets.delete({ service: BUN_SECRETS_SERVICE, name: profileName });
            return;
        } catch (error) {
            disableBunSecrets(error);
        }
    }
    deleteAuthBundleSync(profileName);
}

export function deleteAuthBundleSync(profileName: string): void {
    if (!isSyncKeyringAvailable()) {
        return;
    }
    try {
        getEntry(profileName).deletePassword();
    } catch (error) {
        if (isNotFoundError(error)) {
            return;
        }
        if (isCredentialStoreUnavailableError(error)) {
            return;
        }
        throw error;
    }
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

export function hasStoredAccessTokenSync(profileName: string): boolean {
    try {
        return Boolean(readAuthBundleSync(profileName)?.accessToken);
    } catch (error) {
        if (isCredentialStoreUnavailableError(error)) {
            return false;
        }
        throw error;
    }
}

export function hasStoredRefreshTokenSync(profileName: string): boolean {
    try {
        return Boolean(readAuthBundleSync(profileName)?.refreshToken);
    } catch (error) {
        if (isCredentialStoreUnavailableError(error)) {
            return false;
        }
        throw error;
    }
}

function isNotFoundError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('not found') || message.includes('No such') || message.includes('not exist');
}

function disableBunSecrets(error: unknown): void {
    if (isCredentialStoreUnavailableError(error)) {
        bunSecretsDisabled = true;
    }
}

function isCredentialStoreUnavailableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(KEYRING_UNAVAILABLE_MESSAGE)
        || message.includes('Cannot autolaunch D-Bus')
        || message.includes('No session bus')
        || message.includes('org.freedesktop.secrets')
        || message.includes('Secret Service')
        || message.includes('secret service')
        || message.includes('No keyring')
        || message.includes('keyring is locked')
        || message.includes('Keyring is locked')
        || message.includes('Credential Manager')
        || message.includes('not available')
        || message.includes('unavailable');
}
