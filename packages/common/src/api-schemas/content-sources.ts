import { z } from 'zod';
import {
    CONTENT_SOURCE_MAX_SAMPLE_PERCENT,
    CONTENT_SOURCE_MAX_SYNC_INTERVAL_MINUTES,
    CONTENT_SOURCE_MIN_SAMPLE_PERCENT,
    CONTENT_SOURCE_MIN_SYNC_INTERVAL_MINUTES,
    CONTENT_SOURCE_REPORT_MAX_LIMIT,
    CONTENT_SOURCE_REPORT_ROUNDS,
    CONTENT_SOURCE_SAMPLE_MAX_LIMIT,
} from '../content-sources.js';
import { OBJECT_ID_PATTERN } from './schema-primitives.js';

const CONTENT_SOURCE_NAME_MAX_LENGTH = 128;

export const ContentSourceSyncSettingsSchema = z
    .strictObject({
        enabled: z.boolean().meta({ description: 'Whether the source syncs on its own every `interval_minutes`.' }),
        interval_minutes: z
            .number()
            .int()
            .min(CONTENT_SOURCE_MIN_SYNC_INTERVAL_MINUTES)
            .max(CONTENT_SOURCE_MAX_SYNC_INTERVAL_MINUTES)
            .meta({ description: 'Minutes between two scheduled syncs, from one scheduled time to the next.' }),
    })
    .meta({
        id: 'ContentSourceSyncSettings',
        description:
            'When the source syncs. A source with scheduled sync disabled still syncs on `POST /content-sources/{id}/sync`.',
    });

export const ProjectContentSourcePermissionsSchema = z.strictObject({ mode: z.literal('project') }).meta({
    id: 'ProjectContentSourcePermissions',
});
export const SharePointContentSourcePermissionsSchema = z
    .strictObject({
        mode: z.literal('source'),
        entra_tenant_id: z.uuid(),
        scim_connection_id: z.string().regex(OBJECT_ID_PATTERN),
        permission_reader_provider_id: z.string().regex(OBJECT_ID_PATTERN),
        tenant_group_id: z.string().regex(OBJECT_ID_PATTERN).optional(),
        refresh_minutes: z.number().int().min(15).max(1440).optional(),
        max_stale_hours: z.number().int().min(1).max(168).optional(),
    })
    .meta({ id: 'SharePointContentSourcePermissions' });
export const ContentSourcePermissionSettingsSchema = z
    .union([ProjectContentSourcePermissionsSchema, SharePointContentSourcePermissionsSchema])
    .meta({ id: 'ContentSourcePermissionSettings' });

export const ContentSourcePermissionStatusSchema = z
    .strictObject({
        state: z
            .string()
            .meta({ description: 'Permission state, currently activating, current, stale, or failed_closed.' }),
        version: z.number().int().nonnegative(),
        refreshed_at: z.iso.datetime().optional(),
        unresolved: z.number().int().nonnegative(),
        reason: z
            .string()
            .meta({
                description:
                    'Status reason, currently reconciling, source_refused, refresh_failed, or verification_expired.',
            })
            .optional(),
    })
    .meta({ id: 'ContentSourcePermissionStatus' });

const SAMPLE_PERCENT_DESCRIPTION =
    'Sample mode: syncs only about this percentage of the files, to look at real documents before importing them ' +
    'all. A file is in the sample by a hash of its ID, so the same files stay in it from one sync to the next, ' +
    'spread over every folder. A file outside the sample is not imported, and its document is deleted if it has one.';

const samplePercent = z.number().int().min(CONTENT_SOURCE_MIN_SAMPLE_PERCENT).max(CONTENT_SOURCE_MAX_SAMPLE_PERCENT);

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
    sample_percent: samplePercent
        .meta({ description: `${SAMPLE_PERCENT_DESCRIPTION} Absent when the source syncs every file.` })
        .optional(),
    created_by: z.string().optional(),
    updated_by: z.string().optional(),
    created_at: z.string().meta({ format: 'date-time' }).optional(),
    updated_at: z.string().meta({ format: 'date-time' }).optional(),
};

export const SharePointContentSourceSchema = z
    .strictObject({
        ...commonSourceFields,
        type: z.literal('sharepoint'),
        permissions: ContentSourcePermissionSettingsSchema.optional(),
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
    sample_percent: samplePercent
        .meta({ description: `${SAMPLE_PERCENT_DESCRIPTION} Leave out to sync every file.` })
        .optional(),
};

export const CreateSharePointContentSourcePayloadSchema = z
    .strictObject({
        ...commonCreateFields,
        type: z.literal('sharepoint'),
        permissions: ContentSourcePermissionSettingsSchema.optional(),
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
        folder_id: z
            .string()
            .min(1)
            .meta({
                description:
                    "The Box folder ID, shared with the Box app's service account. Defaults to `0`, every folder " +
                    'shared with the app, to narrow before the first sync with an update.',
            })
            .optional(),
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
            'when the name is already used in the project. Nothing is imported until a sync is requested.',
    });

export const UpdateContentSourcePayloadSchema = z
    .strictObject({
        name: z.string().min(1).max(CONTENT_SOURCE_NAME_MAX_LENGTH).optional(),
        description: z.string().optional(),
        sync: ContentSourceSyncSettingsSchema.optional(),
        sample_percent: samplePercent
            .nullable()
            .meta({
                description:
                    `${SAMPLE_PERCENT_DESCRIPTION} \`null\` removes the sample, so that every file is synced. A ` +
                    'change, before or after the first sync, makes the next sync an import that lists the whole ' +
                    'folder: it imports the files that entered the sample and deletes the documents of those that ' +
                    'left it.',
            })
            .optional(),
        permissions: ContentSourcePermissionSettingsSchema.optional(),
        root_id: z
            .string()
            .min(1)
            .meta({
                description:
                    'Only before the first sync: the root to sync, as `discover/roots` returned it (a SharePoint ' +
                    'document library; for Box, a folder shared with the app). Answers 409 once the source has synced.',
            })
            .optional(),
        folder_id: z
            .string()
            .min(1)
            .meta({
                description:
                    'Only before the first sync: the folder to sync, as a folder listing returned its `id`. Answers ' +
                    '409 once the source has synced.',
            })
            .optional(),
        folder_path: z
            .string()
            .meta({
                description:
                    'SharePoint only, and only before the first sync: the folder to sync inside the library, e.g. ' +
                    '`Contracts/2026`; empty for the whole library. Answers 409 once the source has synced.',
            })
            .optional(),
    })
    .meta({
        id: 'UpdateContentSourcePayload',
        description:
            'Changes the name, description, sync settings or sample, and, before the first sync, the root and ' +
            'folder to sync. Saving sync settings also hands the sync your credentials, which restarts a sync stopped ' +
            'because its previous credentials were refused.',
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
        skipped: z.number().int().meta({
            description: 'Files that are not synced (unsupported types, packages, files outside the sample).',
        }),
        failed: z.number().int(),
    })
    .meta({ id: 'ContentSourceSyncCounts' });

export const ContentSourceSyncRoundSchema = z
    .strictObject({
        id: z
            .string()
            .meta({
                description:
                    "Identifies the round's report, read with `GET /content-sources/{id}/rounds/{roundId}/report`. " +
                    'Absent on rounds that started before reports existed.',
            })
            .optional(),
        kind: z.enum(['import', 'update']).meta({
            description: '`import` lists the whole folder; `update` reads the changes since the previous sync.',
        }),
        started_at: z.string().meta({ format: 'date-time' }),
        finished_at: z.string().meta({ format: 'date-time' }).optional(),
        counts: ContentSourceSyncCountsSchema,
        skipped_by_reason: z
            .record(z.string(), z.number().int())
            .meta({
                description:
                    'The skipped files by reason: `package`, `not_a_file`, `too_large`, `unsupported_type`, ' +
                    "`not_sampled` (outside the source's `sample_percent`; counted only, not listed in the report), " +
                    'or another reason a system reports.',
            })
            .optional(),
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
        permissions: ContentSourcePermissionStatusSchema.optional(),
        current_round: ContentSourceSyncRoundSchema.optional(),
        last_round: ContentSourceSyncRoundSchema.optional(),
        recent_rounds: z
            .array(ContentSourceSyncRoundSchema)
            .meta({
                description: `The last ${CONTENT_SOURCE_REPORT_ROUNDS} finished rounds, newest first. Their reports are kept; older ones are deleted.`,
            })
            .optional(),
        cursor_taken_at: z
            .string()
            .meta({ format: 'date-time', description: 'When the change cursor in use was taken.' })
            .optional(),
        next_sync_at: z.string().meta({ format: 'date-time' }).optional(),
        error: z.string().meta({ description: 'Why the sync is stopped.' }).optional(),
    })
    .meta({ id: 'ContentSourceStatus', description: "A content source's sync state." });

export const ContentSourceRoundSummarySchema = z
    .strictObject({
        kind: z.enum(['import', 'update']).meta({
            description: '`import` lists the whole folder; `update` reads the changes since the previous sync.',
        }),
        started_at: z.string().meta({ format: 'date-time' }),
        finished_at: z.string().meta({ format: 'date-time' }).optional(),
        outcome: z.enum(['succeeded', 'failed']).meta({ description: 'Whether the round finished without an error.' }),
    })
    .meta({ id: 'ContentSourceRoundSummary', description: 'When a finished sync round ran, and how it ended.' });

export const ContentSourceSummarySchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        type: z.enum(['sharepoint', 'box']),
        location_root: commonSourceFields.location_root,
        site_url: z.string().meta({ description: 'SharePoint only: the site URL.' }).optional(),
        library_name: z.string().meta({ description: 'SharePoint only: the document library name.' }).optional(),
        folder_path: z.string().meta({
            description:
                'The folder synced: relative to the library root for SharePoint (empty for the whole library), the ' +
                'folder path below All Files for Box.',
        }),
        sync: ContentSourceSyncSettingsSchema,
        state: ContentSourceStatusSchema.shape.state,
        next_sync_at: z.string().meta({ format: 'date-time' }).optional(),
        last_success_at: z
            .string()
            .meta({
                format: 'date-time',
                description: 'When the last round that finished without an error ended. Absent when none has.',
            })
            .optional(),
        last_round: ContentSourceRoundSummarySchema.optional(),
    })
    .meta({
        id: 'ContentSourceSummary',
        description:
            'What a content source syncs into the project and how its sync stands, readable by every member who can ' +
            'read content. Holds no connection, credential or permission settings.',
    });

export const ContentSourceSummaryArraySchema = z
    .array(ContentSourceSummarySchema)
    .meta({ id: 'ContentSourceSummaryArray' });

export const ContentSourceReportActionSchema = z
    .enum(['created', 'updated', 'deleted', 'skipped', 'failed'])
    .meta({ id: 'ContentSourceReportAction', description: 'What a sync round did with a file.' });

export const ContentSourceReportEntrySchema = z
    .strictObject({
        action: ContentSourceReportActionSchema,
        kind: z
            .enum(['file', 'folder'])
            .meta({ description: '`folder` only for a folder that could not be listed, with its `error`.' }),
        item_id: z.string().meta({ description: "The file's or folder's ID in the external system." }),
        name: z.string(),
        path: z
            .string()
            .meta({ description: "The folder's path below the source's folder; empty for the source's folder itself." })
            .optional(),
        object_id: z.string().meta({ description: 'The document of the file.' }).optional(),
        changes: z
            .array(z.enum(['name', 'location', 'content']))
            .meta({ description: '`updated`: what changed. `content` means the file is processed again.' })
            .optional(),
        reason: z
            .string()
            .meta({
                description:
                    '`skipped`: why the file is not synced (`package`, `not_a_file`, `too_large`, `unsupported_type`). ' +
                    '`deleted`: `file_deleted` (deleted, moved out or no longer synced), `duplicate`, or ' +
                    "`not_sampled` (outside the source's `sample_percent`).",
            })
            .optional(),
        error: z.string().meta({ description: '`failed`: why.' }).optional(),
    })
    .meta({
        id: 'ContentSourceReportEntry',
        description: 'A file a sync round created, updated, deleted, skipped or failed.',
    });

export const ContentSourceReportQuerySchema = z
    .strictObject({
        action: ContentSourceReportActionSchema.meta({ description: 'Only the entries of this action.' }).optional(),
        cursor: z.string().meta({ description: 'The `next_cursor` of the previous page.' }).optional(),
        limit: z
            .number()
            .int()
            .min(1)
            .max(CONTENT_SOURCE_REPORT_MAX_LIMIT)
            .meta({ description: 'Entries per page; 200 when absent.' })
            .optional(),
    })
    .meta({ id: 'ContentSourceReportQuery' });

export const ContentSourceReportSchema = z
    .strictObject({
        round_id: z.string(),
        entries: z.array(ContentSourceReportEntrySchema),
        next_cursor: z.string().meta({ description: 'Present when more entries follow.' }).optional(),
    })
    .meta({
        id: 'ContentSourceReport',
        description:
            'A page of the files a sync round created, updated, deleted, skipped or failed. Unchanged files are only ' +
            "counted, in the round's `counts`. A round still running has a partial report.",
    });

const discoverConnectionFields = {
    type: z.literal('sharepoint').meta({ description: 'The system to inspect. Only SharePoint can be inspected.' }),
    oauth_provider_id: commonCreateFields.oauth_provider_id,
    site_url: z.string().min(1).meta({
        description: 'The SharePoint site URL, e.g. `https://contoso.sharepoint.com/sites/legal`.',
    }),
};

const discoverLibraryField = {
    library_name: z
        .string()
        .min(1)
        .meta({ description: 'The document library name. Defaults to the site’s default library.' })
        .optional(),
};

export const DiscoverContentSourceSitePayloadSchema = z.strictObject(discoverConnectionFields).meta({
    id: 'DiscoverContentSourceSitePayload',
    description: 'The connection to inspect: an OAuth provider and a site. No content source needs to exist.',
});

export const DiscoverContentSourceSchemaPayloadSchema = z
    .strictObject({ ...discoverConnectionFields, ...discoverLibraryField })
    .meta({ id: 'DiscoverContentSourceSchemaPayload', description: 'The document library to read the schema of.' });

export const DiscoverContentSourceSamplePayloadSchema = z
    .strictObject({
        ...discoverConnectionFields,
        ...discoverLibraryField,
        folder_path: z
            .string()
            .meta({ description: 'A folder inside the library, e.g. `Contracts/2026`. Defaults to the whole library.' })
            .optional(),
        limit: z
            .number()
            .int()
            .min(1)
            .max(CONTENT_SOURCE_SAMPLE_MAX_LIMIT)
            .meta({ description: 'The most files to return. Defaults to 100.' })
            .optional(),
    })
    .meta({ id: 'DiscoverContentSourceSamplePayload', description: 'The folder to read a sample of files from.' });

export const DiscoverContentSourceFoldersPayloadSchema = z
    .strictObject({
        ...discoverConnectionFields,
        ...discoverLibraryField,
        folder_path: z
            .string()
            .meta({ description: 'The folder to list, e.g. `Contracts/2026`. Defaults to the library’s root.' })
            .optional(),
    })
    .meta({ id: 'DiscoverContentSourceFoldersPayload', description: 'The folder to list the subfolders of.' });

const inspectRootField = {
    root_id: z
        .string()
        .min(1)
        .meta({
            description:
                'Another root the source’s connection reaches, as `discover/roots` returned it. Defaults to the ' +
                'source’s own root.',
        })
        .optional(),
};

const inspectFolderFields = {
    folder_id: z
        .string()
        .min(1)
        .meta({ description: 'A folder, as a listing returned its `id`. Takes precedence over `folder_path`.' })
        .optional(),
    folder_path: z
        .string()
        .meta({
            description:
                'SharePoint only: a folder inside the library, e.g. `Contracts/2026`; empty for the library’s root.',
        })
        .optional(),
};

export const InspectContentSourceFoldersPayloadSchema = z
    .strictObject({ ...inspectRootField, ...inspectFolderFields })
    .meta({
        id: 'InspectContentSourceFoldersPayload',
        description:
            'The folder to list the subfolders of, through a content source’s connection. Defaults to the top of ' +
            'the root.',
    });

export const InspectContentSourceSchemaPayloadSchema = z.strictObject(inspectRootField).meta({
    id: 'InspectContentSourceSchemaPayload',
    description: 'The root to read the schema of, through a content source’s connection.',
});

export const InspectContentSourceSamplePayloadSchema = z
    .strictObject({
        ...inspectRootField,
        ...inspectFolderFields,
        limit: z
            .number()
            .int()
            .min(1)
            .max(CONTENT_SOURCE_SAMPLE_MAX_LIMIT)
            .meta({ description: 'The most files to return. Defaults to 100.' })
            .optional(),
    })
    .meta({
        id: 'InspectContentSourceSamplePayload',
        description:
            'The folder to read a sample of files from, through a content source’s connection. Defaults to what ' +
            'the source syncs in its own root, and to the top of another root.',
    });

export const ContentSourceRootSchema = z
    .strictObject({
        id: z.string().meta({ description: 'The identifier to pass as `root_id`.' }),
        name: z.string(),
        web_url: z.string().optional(),
    })
    .meta({
        id: 'ContentSourceRoot',
        description: 'What a source can sync from: a SharePoint document library, or a Box folder shared with the app.',
    });

export const ContentSourceRootsDiscoverySchema = z
    .strictObject({
        roots: z.array(ContentSourceRootSchema),
        current_root_id: z.string().meta({ description: 'The root the source syncs from now.' }).optional(),
        truncated: z.boolean().meta({ description: 'True when there are more roots than were read.' }),
    })
    .meta({ id: 'ContentSourceRootsDiscovery', description: 'The roots a content source’s connection reaches.' });

export const ContentSourceLibrarySchema = z
    .strictObject({
        id: z.string().meta({ description: 'The identifier of the library in its system.' }),
        name: z.string().meta({ description: 'The name to pass as `library_name`.' }),
        web_url: z.string().optional(),
    })
    .meta({ id: 'ContentSourceLibrary', description: 'A document library of a site.' });

export const ContentSourceSiteDiscoverySchema = z
    .strictObject({
        site_id: z.string(),
        name: z.string(),
        web_url: z.string().optional(),
        libraries: z.array(ContentSourceLibrarySchema),
    })
    .meta({ id: 'ContentSourceSiteDiscovery', description: 'A site and its document libraries.' });

export const ContentSourceFolderSchema = z
    .strictObject({
        id: z.string().meta({ description: 'The identifier of the folder in its system.' }),
        name: z.string(),
        path: z.string().meta({
            description: 'The path inside the library (SharePoint), or below All Files (Box). Pass `id` to go deeper.',
        }),
        child_count: z.number().int().meta({ description: 'How many files and folders it holds directly.' }).optional(),
    })
    .meta({ id: 'ContentSourceFolder', description: 'A folder a content source can reach.' });

export const ContentSourceFoldersDiscoverySchema = z
    .strictObject({
        root_id: z
            .string()
            .meta({
                description: 'The root read: a SharePoint library. Absent for Box, whose paths start at All Files.',
            })
            .optional(),
        root_name: z.string().optional(),
        folder_id: z.string().meta({ description: 'The folder listed.' }),
        folder_path: z.string().meta({ description: 'The folder listed. Empty for the top of the root.' }),
        folders: z.array(ContentSourceFolderSchema).meta({ description: 'Its direct subfolders, by name.' }),
        truncated: z.boolean().meta({ description: 'True when the folder holds more subfolders than were read.' }),
    })
    .meta({ id: 'ContentSourceFoldersDiscovery', description: 'The direct subfolders of a folder.' });

export const ContentSourceColumnTypeSchema = z
    .enum([
        'text',
        'number',
        'boolean',
        'currency',
        'date',
        'date_time',
        'choice',
        'lookup',
        'person',
        'managed_metadata',
        'url',
        'calculated',
        'location',
        'image',
        'approval_status',
        'unknown',
    ])
    .meta({ id: 'ContentSourceColumnType', description: 'The kind of value a library column holds.' });

export const ContentSourceColumnSchema = z
    .strictObject({
        name: z.string().meta({ description: 'The internal name: the key of the column in a file’s `fields`.' }),
        display_name: z.string(),
        description: z.string().optional(),
        type: ContentSourceColumnTypeSchema,
        required: z.boolean(),
        read_only: z.boolean(),
        multiple: z.boolean().meta({ description: 'Whether a file can hold several values.' }),
        choices: z.array(z.string()).meta({ description: 'The allowed values of a `choice` column.' }).optional(),
    })
    .meta({ id: 'ContentSourceColumn', description: 'A metadata column of a document library.' });

export const ContentSourceContentTypeSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        group: z.string().optional(),
        columns: z.array(ContentSourceColumnSchema),
    })
    .meta({
        id: 'ContentSourceContentType',
        description: 'A kind of document a library defines, with the columns its documents carry.',
    });

export const ContentSourceSchemaDiscoverySchema = z
    .strictObject({
        root_id: z
            .string()
            .meta({
                description: 'The root read: a SharePoint library. Absent for Box, whose paths start at All Files.',
            })
            .optional(),
        root_name: z.string().optional(),
        content_types: z.array(ContentSourceContentTypeSchema).meta({
            description:
                'The kinds of document the system defines, each with its columns: the document content types of a ' +
                'SharePoint library (folder and hidden ones left out), or the metadata templates of a Box enterprise.',
        }),
        columns: z.array(ContentSourceColumnSchema).meta({
            description:
                'Every visible column of a SharePoint library, whichever content type uses it. Empty for Box, whose ' +
                'fields are on its templates.',
        }),
        content_types_truncated: z.boolean().meta({
            description: 'True when there are more content types than were read.',
        }),
    })
    .meta({
        id: 'ContentSourceSchemaDiscovery',
        description: 'How a system describes its documents: content types or metadata templates, and their columns.',
    });

export const ContentSourceSampleFileSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        folder_path: z.string().meta({
            description: 'The folder of the file, inside the library (SharePoint) or below All Files (Box).',
        }),
        size: z.number().int().optional(),
        mime_type: z.string().optional(),
        web_url: z.string().optional(),
        modified_at: z.string().meta({ format: 'date-time' }).optional(),
        content_type: z.string().meta({ description: 'The name of the file’s content type.' }).optional(),
        fields: z.record(z.string(), z.unknown()).meta({
            description: 'The values of the file’s own columns, keyed by internal name. System fields are left out.',
        }),
    })
    .meta({ id: 'ContentSourceSampleFile', description: 'A file of a sample, with its metadata.' });

export const ContentSourceContentTypeCountSchema = z
    .strictObject({ name: z.string(), count: z.number().int() })
    .meta({ id: 'ContentSourceContentTypeCount' });

export const ContentSourceSampleDiscoverySchema = z
    .strictObject({
        root_id: z
            .string()
            .meta({
                description: 'The root read: a SharePoint library. Absent for Box, whose paths start at All Files.',
            })
            .optional(),
        root_name: z.string().optional(),

        files: z.array(ContentSourceSampleFileSchema),
        content_type_counts: z.array(ContentSourceContentTypeCountSchema).meta({
            description: 'How many sampled files have each content type, most frequent first.',
        }),
        folders_read: z.number().int(),
        truncated: z.boolean().meta({
            description: 'True when the folder holds more than was read: the counts describe a sample, not the whole.',
        }),
    })
    .meta({
        id: 'ContentSourceSampleDiscovery',
        description: 'A bounded sample of the files under a folder, spread over its subfolders.',
    });
