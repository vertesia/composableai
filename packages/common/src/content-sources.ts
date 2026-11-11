import type * as Wire from './wire-types.generated.js';

/** The shortest interval between two scheduled syncs of a content source. */
export const CONTENT_SOURCE_MIN_SYNC_INTERVAL_MINUTES = 15;
/** The longest interval: a Box change cursor older than 14 days is treated as lost. */
export const CONTENT_SOURCE_MAX_SYNC_INTERVAL_MINUTES = 7 * 24 * 60;
/** The interval a source gets when scheduled sync is enabled without one. */
export const CONTENT_SOURCE_DEFAULT_SYNC_INTERVAL_MINUTES = 60;

/** A folder of an external content system whose files are synced into the project without copies. */
export type ExternalContentSource = Wire.ExternalContentSource;
export type SharePointContentSource = Wire.SharePointContentSource;
export type BoxContentSource = Wire.BoxContentSource;
export type ExternalContentSourceType = ExternalContentSource['type'];
export type ContentSourceSyncSettings = Wire.ContentSourceSyncSettings;

/** Registers a content source. */
export type CreateContentSourcePayload = Wire.CreateContentSourcePayload;
export type CreateSharePointContentSourcePayload = Wire.CreateSharePointContentSourcePayload;
export type CreateBoxContentSourcePayload = Wire.CreateBoxContentSourcePayload;
export type UpdateContentSourcePayload = Wire.UpdateContentSourcePayload;
export type SyncContentSourcePayload = Wire.SyncContentSourcePayload;

/** A content source's sync state. */
export type ContentSourceStatus = Wire.ContentSourceStatus;
export type ContentSourceSyncRound = Wire.ContentSourceSyncRound;
export type ContentSourceSyncCounts = Wire.ContentSourceSyncCounts;
