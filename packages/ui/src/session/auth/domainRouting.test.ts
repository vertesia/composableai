import { describe, expect, it } from "vitest";
import { Env } from "@vertesia/ui/env";
import { shouldRedirectToCentralAuth, shouldUseFirebaseAuth } from "./domainRouting";

describe("domainRouting", () => {
    it("uses Firebase auth for configured authorized domains", () => {
        Env.init({
            name: "test",
            version: "1.0.0",
            isLocalDev: false,
            isDocker: false,
            type: "test",
            endpoints: {
                studio: "https://api.example.com",
                zeno: "https://api.example.com",
                sts: "https://sts.example.com",
            },
            firebase: {
                apiKey: "test",
                authDomain: "example.firebaseapp.com",
                authorizedDomains: [
                    "cloud.vertesia.io",
                    "preview.cloud.vertesia.io",
                    "cloud.us1.vertesia.io",
                    "preview.eu2.vertesia.io",
                    "tenant-a.cloud.us1.vertesia.io",
                ],
                projectId: "test",
            },
        });

        expect(shouldUseFirebaseAuth("cloud.vertesia.io")).toBe(true);
        expect(shouldUseFirebaseAuth("preview.cloud.vertesia.io")).toBe(true);
        expect(shouldUseFirebaseAuth("cloud.us1.vertesia.io")).toBe(true);
        expect(shouldUseFirebaseAuth("preview.eu2.vertesia.io")).toBe(true);
        expect(shouldUseFirebaseAuth("tenant-a.cloud.us1.vertesia.io")).toBe(true);
    });

    it("routes all other domains through central auth", () => {
        Env.init({
            name: "test",
            version: "1.0.0",
            isLocalDev: false,
            isDocker: false,
            type: "test",
            endpoints: {
                studio: "https://api.example.com",
                zeno: "https://api.example.com",
                sts: "https://sts.example.com",
            },
            firebase: {
                apiKey: "test",
                authDomain: "example.firebaseapp.com",
                authorizedDomains: ["cloud.vertesia.io"],
                projectId: "test",
            },
        });

        expect(shouldUseFirebaseAuth("foo.preview.cloud.vertesia.io")).toBe(false);
        expect(shouldUseFirebaseAuth("preview.vertesia.io")).toBe(false);
        expect(shouldUseFirebaseAuth("studio.vertesia.app")).toBe(false);
        expect(shouldRedirectToCentralAuth("localhost")).toBe(true);
    });

    it("normalizes configured domains before matching", () => {
        Env.init({
            name: "test",
            version: "1.0.0",
            isLocalDev: false,
            isDocker: false,
            type: "test",
            endpoints: {
                studio: "https://api.example.com",
                zeno: "https://api.example.com",
                sts: "https://sts.example.com",
            },
            firebase: {
                apiKey: "test",
                authDomain: "example.firebaseapp.com",
                authorizedDomains: [" Cloud.Vertesia.io "],
                projectId: "test",
            },
        });

        expect(shouldUseFirebaseAuth("cloud.vertesia.io")).toBe(true);
    });
});
