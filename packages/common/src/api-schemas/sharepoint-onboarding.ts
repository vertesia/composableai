import { z } from 'zod';

const guid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
const id = z.string().regex(/^[0-9a-f]{24}$/);
const state = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const BeginSharePointOrganizationLinkPayloadSchema = z
    .strictObject({ tenant_id: guid })
    .meta({ id: 'BeginSharePointOrganizationLinkPayload' });

export const SharePointOrganizationLinkAttemptSchema = z
    .strictObject({ state, expires_at: z.iso.datetime() })
    .meta({ id: 'SharePointOrganizationLinkAttempt' });

export const CompleteSharePointOrganizationLinkPayloadSchema = z
    .strictObject({ state })
    .meta({ id: 'CompleteSharePointOrganizationLinkPayload' });

export const SharePointOrganizationSchema = z
    .strictObject({ tenant_id: guid, linked_at: z.iso.datetime() })
    .meta({ id: 'SharePointOrganization' });

export const SharePointOrganizationsSchema = z
    .strictObject({ organizations: z.array(SharePointOrganizationSchema) })
    .meta({ id: 'SharePointOrganizations' });

const libraryContext = {
    site_hostname: z
        .string()
        .max(253)
        .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.sharepoint\.com$/),
    site_collection_id: guid,
    web_id: guid,
    list_id: guid,
};

export const SharePointLibraryContextSchema = z.strictObject(libraryContext).meta({ id: 'SharePointLibraryContext' });

const status = z.enum([
    'pending_resolution',
    'awaiting_site_grant',
    'library_unavailable',
    'awaiting_approval',
    'approved',
    'connected',
    'disconnected',
]);

export const SharePointLibraryReceiptSchema = z.strictObject({ id, status }).meta({ id: 'SharePointLibraryReceipt' });

export const SharePointLibraryRequestSchema = z
    .strictObject({
        ...libraryContext,
        id,
        tenant_id: guid,
        binding_id: id.optional(),
        site_url: z.url().optional(),
        library_url: z.url().optional(),
        library_name: z.string().min(1).optional(),
        status,
        created_at: z.iso.datetime(),
    })
    .meta({ id: 'SharePointLibraryRequest' });

export const SharePointLibraryRequestsSchema = z
    .strictObject({ requests: z.array(SharePointLibraryRequestSchema), next_cursor: id.optional() })
    .meta({ id: 'SharePointLibraryRequests' });

export const SharePointLibraryRequestsQuerySchema = z
    .strictObject({ cursor: id.optional() })
    .meta({ id: 'SharePointLibraryRequestsQuery' });

export const SharePointRequestProjectSchema = z
    .strictObject({ project_id: id, source_id: z.string().min(1).optional() })
    .meta({ id: 'SharePointRequestProject' });
