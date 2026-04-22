import jwt from 'jsonwebtoken';
import { createRequire } from 'node:module';
import type { Profile } from './index.js';

const require = createRequire(import.meta.url);

const KEYRING_SERVICE = 'vertesia-cli';
const AUTH_BUNDLE_VERSION = 1;
const KEYRING_UNAVAILABLE_MESSAGE = 'Native keyring is required for Vertesia CLI profile authentication.';

interface KeyringModule {
    Entry: new (service: string, account: string) => {
        getPassword(): string | null;
        setPassword(password: string): void;
        deletePassword(): void;
    };
}

export interface StoredAuthBundle {
    version: number;
    accessToken?: string;
    accessTokenExpiresAt?: number;
    refreshToken?: string;
    refreshTokenExpiresAt?: number;
}

type WritableAuthBundle = Omit<StoredAuthBundle, 'version'>;

let cachedKeyringModule: KeyringModule | null | undefined;

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

export function isKeyringAvailable(): boolean {
    return !!getKeyringModule();
}

function getEntry(profileName: string) {
    const keyring = getKeyringModule();
    if (!keyring) {
        throw new Error(KEYRING_UNAVAILABLE_MESSAGE);
    }
    return new keyring.Entry(KEYRING_SERVICE, profileName);
}

function readRaw(profileName: string): string | null {
    if (!isKeyringAvailable()) {
        return null;
    }
    try {
        return getEntry(profileName).getPassword();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found') || message.includes('No such') || message.includes('not exist')) {
            return null;
        }
        throw error;
    }
}

export function readAuthBundle(profileName: string): StoredAuthBundle | undefined {
    const raw = readRaw(profileName);
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

export function writeAuthBundle(profileName: string, bundle: WritableAuthBundle) {
    const payload: StoredAuthBundle = {
        version: AUTH_BUNDLE_VERSION,
        accessToken: bundle.accessToken,
        accessTokenExpiresAt: bundle.accessTokenExpiresAt,
        refreshToken: bundle.refreshToken,
        refreshTokenExpiresAt: bundle.refreshTokenExpiresAt,
    };
    getEntry(profileName).setPassword(JSON.stringify(payload));
}

export function deleteAuthBundle(profileName: string) {
    if (!isKeyringAvailable()) {
        return;
    }
    try {
        getEntry(profileName).deletePassword();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found') || message.includes('No such') || message.includes('not exist')) {
            return;
        }
        throw error;
    }
}

export function readProfileAccessToken(profile: Pick<Profile, 'name' | 'apikey'>): string | undefined {
    const bundle = readAuthBundle(profile.name);
    return bundle?.accessToken || profile.apikey;
}

export function readProfileRefreshToken(profileName: string): string | undefined {
    return readAuthBundle(profileName)?.refreshToken;
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

export function hasStoredAccessToken(profileName: string): boolean {
    return Boolean(readAuthBundle(profileName)?.accessToken);
}

export function hasStoredRefreshToken(profileName: string): boolean {
    return Boolean(readAuthBundle(profileName)?.refreshToken);
}
