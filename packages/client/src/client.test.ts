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
})