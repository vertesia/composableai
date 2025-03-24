import { describe, expect, test } from "vitest";
import { VertesiaClient } from "./client";

describe('Test Vertesia Client', () => {
    test('Initialization with studio and zeno URLs', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
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
        }).toThrowError('storeUrl is required for VertesiaClient');
    });

    test('Initialization with zeno URL only', () => {
        expect(() => {
            new VertesiaClient({
                serverUrl: '',
                storeUrl: 'https://api.vertesia.io',
            });
        }).toThrowError('serverUrl is required for VertesiaClient');
    });

    test('Initialization with site', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
            site: 'api.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.storeUrl).toBe('https://api.vertesia.io');
        expect(client.baseUrl).toBe('https://api.vertesia.io');
    });
});
