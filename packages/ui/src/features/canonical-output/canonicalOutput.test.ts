import { describe, expect, it } from 'vitest';
import { canonicalAssetSource } from './canonicalOutput.js';

const asset = {
    id: 'asset-1',
    kind: 'image' as const,
    mime_type: 'image/png',
    storage: { type: 'inline_base64' as const, data: 'AAEC' },
    provenance: { type: 'generated' as const, generation_id: 'generation-1' },
    created_at: '2026-10-01T00:00:00.000Z',
};

describe('canonical asset source', () => {
    it('exposes only owned inline bytes and browser-resolvable external locations', () => {
        expect(canonicalAssetSource(asset)).toBe('data:image/png;base64,AAEC');
        expect(
            canonicalAssetSource({
                ...asset,
                storage: { type: 'external', resolver: 'google_uri', locator: { uri: 'gs://bucket/image.png' } },
            }),
        ).toBe('gs://bucket/image.png');
        expect(
            canonicalAssetSource({
                ...asset,
                storage: { type: 'external', resolver: 'openai_file', locator: { file_id: 'provider-file' } },
            }),
        ).toBeUndefined();
    });
});
