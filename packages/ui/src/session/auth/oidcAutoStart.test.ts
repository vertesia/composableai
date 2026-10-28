import { describe, expect, it } from 'vitest';
import {
    AUTO_START_COOLDOWN_MS,
    type AutoStartStorage,
    claimOidcAutoStart,
    clearOidcSignOut,
    recordOidcSignOut,
} from './oidcAutoStart';

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
    const items = new Map<string, string>();
    return {
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value),
        removeItem: (key) => void items.delete(key),
    };
}

function browser(): AutoStartStorage {
    return { local: memoryStorage(), session: memoryStorage() };
}

/** Another tab of the same browser: same local storage, its own session storage. */
function otherTab(storage: AutoStartStorage): AutoStartStorage {
    return { local: storage.local, session: memoryStorage() };
}

describe('claimOidcAutoStart', () => {
    it('starts the sign-in on a first visit, once', () => {
        const storage = browser();
        expect(claimOidcAutoStart(false, storage, 1_000)).toBe(true);
        // React's second effect run, or the same tab back on the sign-in page after the round-trip.
        expect(claimOidcAutoStart(false, storage, 1_001)).toBe(false);
        expect(claimOidcAutoStart(false, storage, 1_000 + AUTO_START_COOLDOWN_MS - 1)).toBe(false);
    });

    it('starts again once the last automatic start is old enough', () => {
        const storage = browser();
        expect(claimOidcAutoStart(false, storage, 1_000)).toBe(true);
        expect(claimOidcAutoStart(false, storage, 1_000 + AUTO_START_COOLDOWN_MS)).toBe(true);
    });

    it('never starts after a failed sign-in', () => {
        expect(claimOidcAutoStart(true, browser(), 1_000)).toBe(false);
    });

    it('waits for a click after a sign-out, in every tab, until that click', () => {
        const storage = browser();
        recordOidcSignOut(storage);
        expect(claimOidcAutoStart(false, storage, 1_000)).toBe(false);
        expect(claimOidcAutoStart(false, otherTab(storage), 1_000)).toBe(false);

        clearOidcSignOut(storage);
        expect(claimOidcAutoStart(false, otherTab(storage), 1_000)).toBe(true);
    });

    it('does nothing on its own when storage is refused', () => {
        const refused = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('SecurityError');
            },
            removeItem: () => {
                throw new Error('SecurityError');
            },
        };
        const storage = { local: refused, session: refused };
        expect(claimOidcAutoStart(false, storage, 1_000)).toBe(false);
        expect(() => recordOidcSignOut(storage)).not.toThrow();
        expect(() => clearOidcSignOut(storage)).not.toThrow();
    });
});
