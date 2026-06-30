import { describe, expect, it } from 'vitest';
import { effectiveAppAccessControl } from './apps.js';

describe('effectiveAppAccessControl', () => {
    it("returns 'all' when neither installation nor manifest set the field", () => {
        expect(effectiveAppAccessControl({}, {})).toBe('all');
    });

    it("returns 'all' when both inputs are null/undefined", () => {
        expect(effectiveAppAccessControl(null, null)).toBe('all');
        expect(effectiveAppAccessControl(undefined, undefined)).toBe('all');
        expect(effectiveAppAccessControl(null, undefined)).toBe('all');
    });

    it('falls back to the manifest default when the installation has no override', () => {
        expect(effectiveAppAccessControl({}, { access_control: 'ui' })).toBe('ui');
        expect(effectiveAppAccessControl({}, { access_control: 'none' })).toBe('none');
        expect(effectiveAppAccessControl({}, { access_control: 'all' })).toBe('all');
    });

    it('lets the installation override the manifest default for all three values', () => {
        expect(effectiveAppAccessControl({ access_control: 'ui' }, { access_control: 'all' })).toBe('ui');
        expect(effectiveAppAccessControl({ access_control: 'none' }, { access_control: 'ui' })).toBe('none');
        expect(effectiveAppAccessControl({ access_control: 'all' }, { access_control: 'none' })).toBe('all');
    });

    it('treats null arguments the same as undefined', () => {
        expect(effectiveAppAccessControl(null, { access_control: 'ui' })).toBe('ui');
        expect(effectiveAppAccessControl({ access_control: 'ui' }, null)).toBe('ui');
    });

    it('treats null/undefined access_control fields the same as the field being absent', () => {
        expect(effectiveAppAccessControl({ access_control: undefined }, { access_control: 'ui' })).toBe('ui');
        // The override accepts AppAccessControl | null at the payload boundary; nullish should fall through.
        expect(effectiveAppAccessControl({ access_control: undefined }, { access_control: undefined })).toBe('all');
    });
});
