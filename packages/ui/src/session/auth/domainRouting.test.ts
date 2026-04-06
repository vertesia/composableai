import { afterEach, describe, expect, it } from "vitest";
import { shouldRedirectToCentralAuth, shouldUseFirebaseAuth } from "./domainRouting";

describe("domainRouting", () => {
    afterEach(() => {
        delete (globalThis as any).window;
    });

    it("uses Firebase auth when AUTH_MODE is 'firebase'", () => {
        (globalThis as any).window = { AUTH_MODE: "firebase" };
        expect(shouldUseFirebaseAuth()).toBe(true);
        expect(shouldRedirectToCentralAuth()).toBe(false);
    });

    it("uses central auth when AUTH_MODE is 'central'", () => {
        (globalThis as any).window = { AUTH_MODE: "central" };
        expect(shouldUseFirebaseAuth()).toBe(false);
        expect(shouldRedirectToCentralAuth()).toBe(true);
    });

    it("defaults to central auth when AUTH_MODE is not set", () => {
        (globalThis as any).window = {};
        expect(shouldUseFirebaseAuth()).toBe(false);
        expect(shouldRedirectToCentralAuth()).toBe(true);
    });
});
