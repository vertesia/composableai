import type { ContentObject } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { getContentObjectDownloadName } from './useDownloadFile.js';

describe('getContentObjectDownloadName', () => {
    it('preserves the original source extension instead of an extensionless display name', () => {
        const object = {
            name: 'Quarterly Report',
            content: { name: 'quarterly-report.md', type: 'text/markdown' },
        } as ContentObject;

        expect(getContentObjectDownloadName(object)).toBe('quarterly-report.md');
    });

    it('falls back to the object name when the content has no source name', () => {
        const object = { name: 'Quarterly Report' } as ContentObject;

        expect(getContentObjectDownloadName(object)).toBe('Quarterly Report');
    });
});
