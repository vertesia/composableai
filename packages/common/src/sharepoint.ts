import type * as Wire from './wire-types.generated.js';

/**
 * A SharePoint Online document library, or a folder in one, registered for import. Imported documents
 * reference their file in SharePoint (`sharepoint://<source_id>/<item_id>`) instead of a copy.
 */
export type SharePointSource = Wire.SharePointSource;

/** Registers a SharePoint source. */
export type CreateSharePointSourcePayload = Wire.CreateSharePointSourcePayload;
