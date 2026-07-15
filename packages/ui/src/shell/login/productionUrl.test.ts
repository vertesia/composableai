import { describe, expect, it } from 'vitest';
import { getProductionAppUrl } from './productionUrl.js';

describe('getProductionAppUrl', () => {
    it('sends every production region to its regional site (one cloud.{region} pattern)', () => {
        // us1 is not special-cased — it uses the same regional pattern as every other region.
        expect(getProductionAppUrl('us1')).toBe('https://cloud.us1.vertesia.io/');
        expect(getProductionAppUrl('us2')).toBe('https://cloud.us2.vertesia.io/');
        expect(getProductionAppUrl('eu1')).toBe('https://cloud.eu1.vertesia.io/');
        expect(getProductionAppUrl('jp1')).toBe('https://cloud.jp1.vertesia.io/');
    });

    it('sends a dev region to the production region it mirrors, not the dev host', () => {
        // dev1 mirrors us1: a rejected user must land on production, never back on cloud.dev1.
        expect(getProductionAppUrl('dev1')).toBe('https://cloud.us1.vertesia.io/');
    });

    it('falls back to the canonical non-regional site when the region is unknown', () => {
        expect(getProductionAppUrl(undefined)).toBe('https://cloud.vertesia.io/');
        expect(getProductionAppUrl('')).toBe('https://cloud.vertesia.io/');
    });
});
