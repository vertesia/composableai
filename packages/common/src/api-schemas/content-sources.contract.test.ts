import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from './registry.js';

const OBJECT_ID = '6aefdc6b3db5a49d7587027d';
const source = {
    mode: 'source',
    entra_tenant_id: '14e7a391-efbe-4dca-b73a-4c386e272a82',
    scim_connection_id: OBJECT_ID,
};

describe('content source permission settings', () => {
    it.each([{ mode: 'project' }, source])('accepts the $mode settings through the wire contract', (permissions) => {
        expect(validateApiRequest('UpdateContentSourcePayload', { permissions }).valid).toBe(true);
        expect(validateApiResponse('ContentSourcePermissionSettings', permissions).valid).toBe(true);
        expect(
            validateApiRequest('UpdateContentSourcePayload', { permissions: { ...permissions, extra: true } }).valid,
        ).toBe(false);
    });

    it('requires tenant identity and accepts an omitted SCIM connection in source mode', () => {
        expect(validateApiRequest('UpdateContentSourcePayload', { permissions: { mode: 'source' } }).valid).toBe(false);
        expect(
            validateApiRequest('UpdateContentSourcePayload', {
                permissions: { mode: 'source', entra_tenant_id: source.entra_tenant_id },
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('UpdateContentSourcePayload', { permissions: { ...source, mode: 'project' } }).valid,
        ).toBe(false);
    });

    it('allows newer permission states and reasons in status responses', () => {
        expect(
            validateApiResponse('ContentSourceStatus', {
                state: 'waiting',
                permissions: { state: 'awaiting_review', reason: 'new_reason', version: 1, unresolved: 0 },
            }).valid,
        ).toBe(true);
    });
});

describe('managed SharePoint reader setup', () => {
    it('accepts explicit site policy confirmation and leaves uniform registration unchanged', () => {
        expect(validateApiRequest('ConfigureSharePointLibraryReaderPayload', {}).valid).toBe(true);
        expect(
            validateApiRequest('ConfigureSharePointLibraryReaderPayload', {
                permissions: source,
                site_policy_confirmed: true,
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('ConfigureSharePointLibraryReaderPayload', {
                permissions: source,
                site_policy_confirmed: 'true',
            }).valid,
        ).toBe(false);
    });
});
