import { describe, expect, it } from 'vitest';
import * as sdk from './index.js';

describe('public SDK boundary', () => {
    it('excludes internal service topics from exports and client instances', () => {
        expect(Object.keys(sdk).filter((name) => name.startsWith('Internal'))).toEqual([]);
        const client = new sdk.VertesiaClient({ site: 'api.vertesia.io' });
        expect(Object.keys(client).filter((name) => name.startsWith('internal'))).toEqual([]);
    });
});
