import { describe, expect, test } from "vitest";
import { VertesiaClient } from "./client";

describe('Test Vertesia Client', () => {
    test('Initialization with studio and zeno URLs', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
            tokenServerUrl: 'https://sts.vertesia.io',
            apikey: '1234',
        });
        expect(client).toBeDefined();
    });

    test('Initialization with studio URL only', () => {
        expect(() => {
            new VertesiaClient({
                serverUrl: 'https://api.vertesia.io',
                storeUrl: '',
            });
        }).toThrowError("Parameter 'site' or 'storeUrl' is required for VertesiaClient");
    });

    test('Initialization with zeno URL only', () => {
        expect(() => {
            new VertesiaClient({
                serverUrl: '',
                storeUrl: 'https://api.vertesia.io',
            });
        }).toThrowError("Parameter 'site' or 'serverUrl' is required for VertesiaClient");
    });

    test('Initialization with same site', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
            site: 'api.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api.vertesia.io');
        expect(client.storeUrl).toBe('https://api.vertesia.io');
    });

    test('Initialization with default parameters', () => {
        const client = new VertesiaClient();

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api.vertesia.io');
        expect(client.storeUrl).toBe('https://api.vertesia.io');
        expect(client.tokenServerUrl).toBe('https://sts.vertesia.io');
    });

    test('Initialization with site api-preview.vertesia.io', () => {
        const client = new VertesiaClient({
            site: 'api-preview.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api-preview.vertesia.io');
        expect(client.storeUrl).toBe('https://api-preview.vertesia.io');
        expect(client.tokenServerUrl).toBe('https://sts.vertesia.io');
    });

    test('Initialization with site api-staging.vertesia.io', () => {
        const client = new VertesiaClient({
            site: 'api-staging.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api-staging.vertesia.io');
        expect(client.storeUrl).toBe('https://api-staging.vertesia.io');
        expect(client.tokenServerUrl).toBe('https://sts-staging.vertesia.io');
    });

    test('Initialization with site localhost', () => {
        const client = new VertesiaClient({
            serverUrl: 'http://localhost:8091',
            storeUrl: 'http://localhost:8092',
            tokenServerUrl: 'http://localhost:8093',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('http://localhost:8091');
        expect(client.storeUrl).toBe('http://localhost:8092');
    });

    test('Initialization with overrides', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://studio-server-production.api.becomposable.com',
            storeUrl: 'https://zeno-server-production.api.becomposable.com',
            site: 'api.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://studio-server-production.api.becomposable.com');
        expect(client.storeUrl).toBe('https://zeno-server-production.api.becomposable.com');
    });
});
