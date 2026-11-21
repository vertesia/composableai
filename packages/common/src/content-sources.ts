import type * as Wire from './wire-types.generated.js';

/** The shortest interval between two scheduled syncs of a content source. */
export const CONTENT_SOURCE_MIN_SYNC_INTERVAL_MINUTES = 15;
/** The longest interval: a Box change cursor older than 14 days is treated as lost. */
export const CONTENT_SOURCE_MAX_SYNC_INTERVAL_MINUTES = 7 * 24 * 60;
/** The interval a source gets when scheduled sync is enabled without one. */
export const CONTENT_SOURCE_DEFAULT_SYNC_INTERVAL_MINUTES = 60;
/** The finished rounds whose reports are kept; an older round's report is deleted. */
export const CONTENT_SOURCE_REPORT_ROUNDS = 10;
/** The most entries one page of a round's report returns. */
export const CONTENT_SOURCE_REPORT_MAX_LIMIT = 1000;
/** The most files a sample of a source's folder returns. */
export const CONTENT_SOURCE_SAMPLE_MAX_LIMIT = 500;
/** The smallest share of a source's files, in percent, that a sample mode syncs. */
export const CONTENT_SOURCE_MIN_SAMPLE_PERCENT = 1;
/** The largest share of a sample mode: 100 would be every file, which is a source without a sample. */
export const CONTENT_SOURCE_MAX_SAMPLE_PERCENT = 99;

/** A folder of an external content system whose files are synced into the project without copies. */
export type ExternalContentSource = Wire.ExternalContentSource;
export type SharePointContentSource = Wire.SharePointContentSource;
export type BoxContentSource = Wire.BoxContentSource;
export type ExternalContentSourceType = ExternalContentSource['type'];
export type ContentSourcePermissionSettings = Wire.ContentSourcePermissionSettings;
export type ContentSourcePermissionStatus = Wire.ContentSourcePermissionStatus;
export type ProjectContentSourcePermissions = Wire.ProjectContentSourcePermissions;
export type SharePointContentSourcePermissions = Wire.SharePointContentSourcePermissions;
export type ContentSourceSyncSettings = Wire.ContentSourceSyncSettings;

/** Registers a content source. */
export type CreateContentSourcePayload = Wire.CreateContentSourcePayload;
export type CreateSharePointContentSourcePayload = Wire.CreateSharePointContentSourcePayload;
export type CreateBoxContentSourcePayload = Wire.CreateBoxContentSourcePayload;
export type UpdateContentSourcePayload = Wire.UpdateContentSourcePayload;
export type SyncContentSourcePayload = Wire.SyncContentSourcePayload;

/** A content source's sync state. */
export type ContentSourceStatus = Wire.ContentSourceStatus;
/** Whether a source's system notifies Vertesia of changes, between its scheduled syncs. */
export type ContentSourceNotificationStatus = Wire.ContentSourceNotificationStatus;
export type ContentSourceSyncRound = Wire.ContentSourceSyncRound;
export type ContentSourceSyncCounts = Wire.ContentSourceSyncCounts;

/** What a content source syncs and how its sync stands, without its connection settings. */
export type ContentSourceSummary = Wire.ContentSourceSummary;
export type ContentSourceRoundSummary = Wire.ContentSourceRoundSummary;

/** A page of the files a sync round created, updated, deleted, skipped or failed. */
export type ContentSourceReport = Wire.ContentSourceReport;
export type ContentSourceReportEntry = Wire.ContentSourceReportEntry;
export type ContentSourceReportAction = Wire.ContentSourceReportAction;
export type ContentSourceReportQuery = Wire.ContentSourceReportQuery;

/** The connection an inspection reads through. No content source needs to exist. */
export type DiscoverContentSourceSitePayload = Wire.DiscoverContentSourceSitePayload;
export type DiscoverContentSourceSchemaPayload = Wire.DiscoverContentSourceSchemaPayload;
export type DiscoverContentSourceSamplePayload = Wire.DiscoverContentSourceSamplePayload;
export type DiscoverContentSourceFoldersPayload = Wire.DiscoverContentSourceFoldersPayload;
export type InspectContentSourceFoldersPayload = Wire.InspectContentSourceFoldersPayload;
export type InspectContentSourceSchemaPayload = Wire.InspectContentSourceSchemaPayload;
export type InspectContentSourceSamplePayload = Wire.InspectContentSourceSamplePayload;
export type ContentSourceRoot = Wire.ContentSourceRoot;
export type ContentSourceRootsDiscovery = Wire.ContentSourceRootsDiscovery;

/** A site and its document libraries. */
export type ContentSourceSiteDiscovery = Wire.ContentSourceSiteDiscovery;
export type ContentSourceLibrary = Wire.ContentSourceLibrary;

/** The direct subfolders of a folder of a library. */
export type ContentSourceFoldersDiscovery = Wire.ContentSourceFoldersDiscovery;
export type ContentSourceFolder = Wire.ContentSourceFolder;

/** The content types and columns of a document library. */
export type ContentSourceSchemaDiscovery = Wire.ContentSourceSchemaDiscovery;
export type ContentSourceContentType = Wire.ContentSourceContentType;
export type ContentSourceColumn = Wire.ContentSourceColumn;
export type ContentSourceColumnType = Wire.ContentSourceColumnType;

/** A bounded sample of the files under a folder. */
export type ContentSourceSampleDiscovery = Wire.ContentSourceSampleDiscovery;
export type ContentSourceSampleFile = Wire.ContentSourceSampleFile;
export type ContentSourceContentTypeCount = Wire.ContentSourceContentTypeCount;
