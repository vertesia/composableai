import { describe, expect, it } from 'vitest';
import { getProductionAppUrl } from './productionUrl.js';

describe('getProductionAppUrl', () => {
    it('sends a non-US region to its own regional production site', () => {
        expect(getProductionAppUrl('eu1')).toBe('https://cloud.eu1.vertesia.io/');
        expect(getProductionAppUrl('jp1')).toBe('https://cloud.jp1.vertesia.io/');
    });

    it('sends US regions to the canonical non-regional production site', () => {
        expect(getProductionAppUrl('us1')).toBe('https://cloud.vertesia.io/');
        expect(getProductionAppUrl('us')).toBe('https://cloud.vertesia.io/');
    });

    it('sends a dev region to the production region it mirrors, not the dev host', () => {
        // dev1 mirrors us1: a rejected user must land on production, never back on cloud.dev1.
        expect(getProductionAppUrl('dev1')).toBe('https://cloud.us1.vertesia.io/');
    });

    it('falls back to the canonical production site when the region is unknown', () => {
        expect(getProductionAppUrl(undefined)).toBe('https://cloud.vertesia.io/');
        expect(getProductionAppUrl('')).toBe('https://cloud.vertesia.io/');
    });
});
