import { describe, expect, it } from 'vitest';
import { nativeNoticesPath } from './index.js';

describe('nativeNoticesPath', () => {
    it('finds the notices in the native package, beside bin/', () => {
        expect(nativeNoticesPath('/usr/lib/node_modules/@vertesia/cli-darwin-arm64/bin/vertesia')).toBe(
            '/usr/lib/node_modules/@vertesia/cli-darwin-arm64/THIRD-PARTY-NOTICES.txt',
        );
    });
});
