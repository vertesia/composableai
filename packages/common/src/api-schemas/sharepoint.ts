import { z } from 'zod';

const SHAREPOINT_SOURCE_NAME_MAX_LENGTH = 128;

export const SharePointSourceSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        oauth_provider_id: z.string().meta({
            description: 'The OAuth provider (client credentials against Microsoft Entra ID) that issues Graph tokens.',
        }),
        site_url: z.string().meta({ description: 'The SharePoint site URL the source was created from.' }),
        site_id: z.string().meta({ description: 'The Microsoft Graph site ID.' }),
        drive_id: z.string().meta({ description: 'The Microsoft Graph drive ID of the document library.' }),
        library_name: z.string().meta({ description: 'The document library name.' }),
        folder_path: z.string().meta({
            description: 'The folder imported, relative to the library root. Empty for the whole library.',
        }),
        folder_item_id: z.string().meta({ description: 'The Microsoft Graph item ID of the imported folder.' }),
        location_root: z.string().meta({
            description: "The `location` under which the folder's tree is reproduced, e.g. `/sharepoint/legal`.",
        }),
        collection_id: z
            .string()
            .meta({ description: 'Collection that imported documents are added to, if any.' })
            .optional(),
        created_by: z.string().optional(),
        updated_by: z.string().optional(),
        created_at: z.string().meta({ format: 'date-time' }).optional(),
        updated_at: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({
        id: 'SharePointSource',
        description:
            'A SharePoint Online document library, or a folder in one, registered for import. Imported documents ' +
            'reference their file in SharePoint (`sharepoint://<source_id>/<item_id>`) instead of a copy.',
    });

export const CreateSharePointSourcePayloadSchema = z
    .strictObject({
        name: z.string().min(1).max(SHAREPOINT_SOURCE_NAME_MAX_LENGTH).meta({
            description: 'Unique within the project.',
        }),
        description: z.string().optional(),
        oauth_provider_id: z
            .string()
            .min(1)
            .meta({
                description:
                    'An OAuth provider of this project with grant type `client_credentials` against Microsoft Entra ID and ' +
                    'the scope `https://graph.microsoft.com/.default`.',
            }),
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
            .meta({ description: 'A folder inside the library to import, e.g. `Contracts/2026`. Defaults to all.' })
            .optional(),
        location_root: z
            .string()
            .meta({ description: 'The `location` root for imported documents. Defaults to `/sharepoint/<name>`.' })
            .optional(),
        collection_id: z.string().meta({ description: 'A collection to add imported documents to.' }).optional(),
    })
    .meta({
        id: 'CreateSharePointSourcePayload',
        description:
            'Registers a SharePoint source. The server checks the site, library and folder with Microsoft Graph ' +
            'before saving, and answers 409 when the name is already used in the project.',
    });

export const SharePointSourceArraySchema = z.array(SharePointSourceSchema).meta({ id: 'SharePointSourceArray' });
