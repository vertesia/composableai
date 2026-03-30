import { describe, expect, it } from "vitest";
import { shouldRedirectToCentralAuth, shouldUseFirebaseAuth } from "./domainRouting";

describe("domainRouting", () => {
    it("uses Firebase auth for the known global domains", () => {
        expect(shouldUseFirebaseAuth("cloud.vertesia.io")).toBe(true);
        expect(shouldUseFirebaseAuth("preview.cloud.vertesia.io")).toBe(true);
    });

    it("uses Firebase auth for supported regional domains", () => {
        expect(shouldUseFirebaseAuth("cloud.us1.vertesia.io")).toBe(true);
        expect(shouldUseFirebaseAuth("preview.eu2.vertesia.io")).toBe(true);
        expect(shouldUseFirebaseAuth("tenant-a.cloud.us1.vertesia.io")).toBe(true);
    });

    it("routes all other domains through central auth", () => {
        expect(shouldUseFirebaseAuth("foo.preview.cloud.vertesia.io")).toBe(false);
        expect(shouldUseFirebaseAuth("preview.vertesia.io")).toBe(false);
        expect(shouldUseFirebaseAuth("studio.vertesia.app")).toBe(false);
        expect(shouldRedirectToCentralAuth("localhost")).toBe(true);
    });
});
