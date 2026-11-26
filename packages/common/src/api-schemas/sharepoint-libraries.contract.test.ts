import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from '../api-contract/index.js';
import { ApproveSharePointLibraryPayloadSchema } from './sharepoint-libraries.js';

const dedicated = {
    manager_id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    reader_group_id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    audience: 'uniform',
};
const existing = { project_id: 'cccccccccccccccccccccccc', audience: 'mirrored' };

describe('SharePoint library approval contract', () => {
    it.each([dedicated, { ...dedicated, project_name: 'Contracts' }, existing])(
        'accepts a complete project destination',
        (payload) => {
            expect(ApproveSharePointLibraryPayloadSchema.safeParse(payload).success).toBe(true);
            expect(validateApiRequest('ApproveSharePointLibraryPayload', payload).valid).toBe(true);
        },
    );

    it.each([
        { ...dedicated, project_id: existing.project_id },
        { ...existing, reader_group_id: dedicated.reader_group_id },
        { ...existing, project_name: 'Contracts' },
        { audience: 'uniform', manager_id: dedicated.manager_id },
    ])('rejects partial or mixed project destinations', (payload) => {
        expect(ApproveSharePointLibraryPayloadSchema.safeParse(payload).success).toBe(false);
        expect(validateApiRequest('ApproveSharePointLibraryPayload', payload).valid).toBe(false);
    });
});

it('keeps the historical dedicated approval shape and permits attachments without that approval object', () => {
    const attachment = {
        id: dedicated.manager_id,
        tenant_id: 'tenant',
        site_id: 'site',
        list_id: 'list',
        drive_id: 'drive',
        site_url: 'https://example.sharepoint.com/sites/Legal',
        library_url: 'https://example.sharepoint.com/sites/Legal/Contracts',
        library_name: 'Contracts',
        project_id: existing.project_id,
        project_mode: 'existing',
        stage: 'configure_reader',
        can_manage: true,
    };
    const metadata = {
        audience: existing.audience,
        project_name: 'Contracts',
        approved_by: dedicated.manager_id,
        approved_at: '2026-11-24T05:00:00.000Z',
    };
    expect(validateApiResponse('SharePointLibraryConnection', attachment).valid).toBe(true);
    expect(validateApiResponse('SharePointLibraryConnection', { ...attachment, approval: metadata }).valid).toBe(false);
    expect(
        validateApiResponse('SharePointLibraryConnection', {
            ...attachment,
            project_mode: 'dedicated',
            approval: { ...metadata, manager_id: dedicated.manager_id, reader_group_id: dedicated.reader_group_id },
        }).valid,
    ).toBe(true);
});
