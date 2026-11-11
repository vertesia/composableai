import { z } from 'zod';
import {
    CONTENT_SOURCE_MAX_SYNC_INTERVAL_MINUTES,
    CONTENT_SOURCE_MIN_SYNC_INTERVAL_MINUTES,
} from '../content-sources.js';

const CONTENT_SOURCE_NAME_MAX_LENGTH = 128;

export const ContentSourceSyncSettingsSchema = z
    .strictObject({
        enabled: z.boolean().meta({ description: 'Whether the source syncs on its own every `interval_minutes`.' }),
        interval_minutes: z
            .number()
            .int()
            .min(CONTENT_SOURCE_MIN_SYNC_INTERVAL_MINUTES)
            .max(CONTENT_SOURCE_MAX_SYNC_INTERVAL_MINUTES)
            .meta({ description: 'Minutes between the end of one sync and the start of the next.' }),
    })
    .meta({
        id: 'ContentSourceSyncSettings',
        description:
            'When the source syncs. A source with scheduled sync disabled still syncs on `POST /content-sources/{id}/sync`.',
    });

const commonSourceFields = {
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    oauth_provider_id: z.string().meta({
        description: "The project's OAuth provider (grant type `client_credentials`) that issues the system's tokens.",
    }),
    location_root: z.string().meta({
        description: "The `location` under which the source folder's tree is reproduced, e.g. `/sharepoint/legal`.",
    }),
    collection_id: z
        .string()
        .meta({ description: 'Collection that synced documents are added to, if any.' })
        .optional(),
    sync: ContentSourceSyncSettingsSchema,
    created_by: z.string().optional(),
    updated_by: z.string().optional(),
    created_at: z.string().meta({ format: 'date-time' }).optional(),
    updated_at: z.string().meta({ format: 'date-time' }).optional(),
};

export const SharePointContentSourceSchema = z
    .strictObject({
        ...commonSourceFields,
        type: z.literal('sharepoint'),
        site_url: z.string().meta({ description: 'The SharePoint site URL the source was created from.' }),
        site_id: z.string().meta({ description: 'The Microsoft Graph site ID.' }),
        drive_id: z.string().meta({ description: 'The Microsoft Graph drive ID of the document library.' }),
        library_name: z.string().meta({ description: 'The document library name.' }),
        folder_path: z.string().meta({
            description: 'The folder synced, relative to the library root. Empty for the whole library.',
        }),
        folder_item_id: z.string().meta({ description: 'The Microsoft Graph item ID of the synced folder.' }),
    })
    .meta({
        id: 'SharePointContentSource',
        description:
            'A SharePoint Online document library, or a folder in one. Synced documents reference their file in ' +
            'SharePoint (`sharepoint://<source_id>/<item_id>`) instead of a copy.',
    });

export const BoxContentSourceSchema = z
    .strictObject({
        ...commonSourceFields,
        type: z.literal('box'),
        folder_id: z.string().meta({ description: 'The Box folder ID.' }),
        folder_name: z.string().meta({ description: 'The Box folder name when the source was created.' }),
        folder_path: z.string().meta({ description: 'The Box folder path when the source was created.' }),
    })
    .meta({
        id: 'BoxContentSource',
        description:
            'A Box folder. Synced documents reference their file in Box (`box://<source_id>/<file_id>`) instead of a ' +
            'copy.',
    });

export const ExternalContentSourceSchema = z
    .discriminatedUnion('type', [SharePointContentSourceSchema, BoxContentSourceSchema])
    .meta({
        id: 'ExternalContentSource',
        description: 'A folder of an external content system whose files are synced into the project without copies.',
    });

export const ExternalContentSourceArraySchema = z
    .array(ExternalContentSourceSchema)
    .meta({ id: 'ExternalContentSourceArray' });

const commonCreateFields = {
    name: z.string().min(1).max(CONTENT_SOURCE_NAME_MAX_LENGTH).meta({ description: 'Unique within the project.' }),
    description: z.string().optional(),
    oauth_provider_id: z.string().min(1).meta({
        description: 'An OAuth provider of this project with grant type `client_credentials` for the system.',
    }),
    location_root: z
        .string()
        .meta({ description: 'The `location` root for synced documents. Defaults to `/<type>/<name>`.' })
        .optional(),
    collection_id: z.string().meta({ description: 'A collection to add synced documents to.' }).optional(),
    sync: ContentSourceSyncSettingsSchema.optional().meta({
        description: 'Defaults to scheduled sync disabled, every 60 minutes once enabled.',
    }),
};

export const CreateSharePointContentSourcePayloadSchema = z
    .strictObject({
        ...commonCreateFields,
        type: z.literal('sharepoint'),
        site_url: z.string().min(1).meta({
            description: 'The SharePoint site URL, e.g. `https://contoso.sharepoint.com/sites/legal`.',
        }),
        library_name: z
            .string()
            .min(1)
            .meta({ description: 'The document library name. Defaults to the site’s default library.' })
            .optional(),
        folder_path: z
            .string()
            .meta({ description: 'A folder inside the library, e.g. `Contracts/2026`. Defaults to the whole library.' })
            .optional(),
    })
    .meta({
        id: 'CreateSharePointContentSourcePayload',
        description:
            'Registers a SharePoint source. The OAuth provider authenticates against Microsoft Entra ID with the scope ' +
            '`https://graph.microsoft.com/.default`.',
    });

export const CreateBoxContentSourcePayloadSchema = z
    .strictObject({
        ...commonCreateFields,
        type: z.literal('box'),
        folder_id: z.string().min(1).meta({
            description: "The Box folder ID, shared with the Box app's service account.",
        }),
    })
    .meta({
        id: 'CreateBoxContentSourcePayload',
        description:
            "Registers a Box source. The OAuth provider uses Box's client credentials grant, with the token parameters " +
            '`box_subject_type` and `box_subject_id`.',
    });

export const CreateContentSourcePayloadSchema = z
    .discriminatedUnion('type', [CreateSharePointContentSourcePayloadSchema, CreateBoxContentSourcePayloadSchema])
    .meta({
        id: 'CreateContentSourcePayload',
        description:
            'Registers a content source. The server checks the folder with the system before saving, answers 409 ' +
            'when the name is already used in the project, then starts the first sync.',
    });

export const UpdateContentSourcePayloadSchema = z
    .strictObject({
        name: z.string().min(1).max(CONTENT_SOURCE_NAME_MAX_LENGTH).optional(),
        description: z.string().optional(),
        sync: ContentSourceSyncSettingsSchema.optional(),
    })
    .meta({
        id: 'UpdateContentSourcePayload',
        description:
            'Changes the name, description or sync settings. Saving sync settings also hands the sync your ' +
            'credentials, which restarts a sync stopped because its previous credentials were refused.',
    });

export const SyncContentSourcePayloadSchema = z
    .strictObject({
        full: z
            .boolean()
            .meta({
                description:
                    'List the whole folder again and delete the documents of files that no longer exist, instead of ' +
                    'reading only the changes.',
            })
            .optional(),
    })
    .meta({ id: 'SyncContentSourcePayload' });

export const ContentSourceSyncCountsSchema = z
    .strictObject({
        listed: z.number().int().meta({ description: 'Files listed or reported as changed.' }),
        created: z.number().int(),
        updated: z.number().int(),
        unchanged: z.number().int(),
        deleted: z.number().int(),
        skipped: z.number().int().meta({ description: 'Files that are not synced (unsupported types, packages).' }),
        failed: z.number().int(),
    })
    .meta({ id: 'ContentSourceSyncCounts' });

export const ContentSourceSyncRoundSchema = z
    .strictObject({
        kind: z.enum(['import', 'update']).meta({
            description: '`import` lists the whole folder; `update` reads the changes since the previous sync.',
        }),
        started_at: z.string().meta({ format: 'date-time' }),
        finished_at: z.string().meta({ format: 'date-time' }).optional(),
        counts: ContentSourceSyncCountsSchema,
        swept: z
            .boolean()
            .meta({ description: 'Whether an import ended by deleting the documents of files no longer listed.' })
            .optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'ContentSourceSyncRound' });

export const ContentSourceStatusSchema = z
    .strictObject({
        state: z.enum(['not_started', 'running', 'waiting', 'stopped']).meta({
            description:
                '`waiting` between syncs, `running` during one, `stopped` when its credentials were refused or the ' +
                'source is being deleted.',
        }),
        current_round: ContentSourceSyncRoundSchema.optional(),
        last_round: ContentSourceSyncRoundSchema.optional(),
        cursor_taken_at: z
            .string()
            .meta({ format: 'date-time', description: 'When the change cursor in use was taken.' })
            .optional(),
        next_sync_at: z.string().meta({ format: 'date-time' }).optional(),
        error: z.string().meta({ description: 'Why the sync is stopped.' }).optional(),
    })
    .meta({ id: 'ContentSourceStatus', description: "A content source's sync state." });
