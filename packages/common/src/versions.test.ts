import { describe, expect, it } from 'vitest';
import {
    ApiVersions,
    CURRENT_API_VERSION,
    CURRENT_API_VERSION_HEADER_VALUE,
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION,
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
} from './versions.js';

describe('API versions', () => {
    it('keeps the current API version aligned with the latest milestone', () => {
        const milestones = Object.values(ApiVersions).filter(
            (version): version is number => typeof version === 'number',
        );

        expect(CURRENT_API_VERSION).toBe(Math.max(...milestones));
        expect(CURRENT_API_VERSION_HEADER_VALUE).toBe(String(CURRENT_API_VERSION));
    });

    it('keeps canonical interaction execution behind an exact experimental opt-in', () => {
        expect(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE).toBe(
            `=${EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION}`,
        );
        expect(Object.values(ApiVersions)).not.toContain(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION);
        expect(CURRENT_API_VERSION).not.toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION);
    });
});
