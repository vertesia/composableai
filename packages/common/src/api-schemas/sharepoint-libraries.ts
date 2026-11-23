import { z } from 'zod';
import { ContentSourceSummarySchema, SharePointContentSourcePermissionsSchema } from './content-sources.js';
import { OBJECT_ID_PATTERN } from './schema-primitives.js';

const audience = z.enum(['uniform', 'mirrored']);
const projectName = z.string().min(1).max(128);
const objectId = z.string().regex(OBJECT_ID_PATTERN);

export const SharePointLibraryPathParamsSchema = z
    .strictObject({ bindingId: objectId })
    .meta({ id: 'SharePointLibraryPathParams' });

export const ManagedSharePointLibrarySchema = z
    .strictObject({
        id: objectId,
        tenant_id: z.string(),
        site_id: z.string(),
        site_url: z.string(),
        drive_id: z.string(),
        audience,
        oauth_provider_id: objectId.optional(),
        lifecycle: z.enum(['disconnecting', 'disconnected']).optional(),
    })
    .meta({ id: 'ManagedSharePointLibrary', readOnly: true });

const approvalFields = {
    manager_id: objectId,
    reader_group_id: objectId,
    audience,
};

export const ApproveSharePointLibraryPayloadSchema = z
    .strictObject({ ...approvalFields, project_name: projectName.optional() })
    .meta({ id: 'ApproveSharePointLibraryPayload' });

export const ConfigureSharePointLibraryReaderPayloadSchema = z
    .strictObject({
        oauth_provider_id: objectId,
        permissions: SharePointContentSourcePermissionsSchema.optional(),
    })
    .meta({ id: 'ConfigureSharePointLibraryReaderPayload' });

export const SharePointLibraryApprovalSchema = z
    .strictObject({
        ...approvalFields,
        project_name: projectName,
        approved_by: objectId,
        approved_at: z.iso.datetime(),
    })
    .meta({ id: 'SharePointLibraryApproval' });

export const SharePointLibraryConnectionSchema = z
    .strictObject({
        id: objectId,
        tenant_id: z.string(),
        site_id: z.string(),
        list_id: z.string(),
        drive_id: z.string(),
        site_url: z.string(),
        library_url: z.string(),
        library_name: z.string(),
        project_name: projectName.optional(),
        audience: audience.optional(),
        can_manage: z.boolean(),
        stage: z.enum([
            'pending_approval',
            'provisioning_project',
            'configure_reader',
            'ready',
            'disconnecting',
            'disconnected',
        ]),
        project_id: objectId.optional(),
        oauth_provider_id: objectId.optional(),
        source_id: objectId.optional(),
        approval: SharePointLibraryApprovalSchema.optional(),
        sync: ContentSourceSummarySchema.optional(),
    })
    .meta({ id: 'SharePointLibraryConnection' });

export const SharePointLibraryConnectionArraySchema = z
    .array(SharePointLibraryConnectionSchema)
    .meta({ id: 'SharePointLibraryConnectionArray' });

export const ProjectSharePointLibraryResponseSchema = z
    .strictObject({ library: SharePointLibraryConnectionSchema.nullable() })
    .meta({ id: 'ProjectSharePointLibraryResponse' });
