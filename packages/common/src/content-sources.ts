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
/** The most files a sample of chosen files (`sample_item_ids`) can name. */
export const CONTENT_SOURCE_MAX_SAMPLE_ITEM_IDS = 200;
/**
 * The `sample_percent` stored and returned beside `sample_item_ids`. A worker or client that predates the list then
 * syncs about 1% of the files instead of every file; one that knows the list syncs the listed files, and only while
 * the percentage is this value, so a sample changed by a server that predates the list is not overruled by it.
 */
export const CONTENT_SOURCE_SAMPLE_ITEM_IDS_GUARD_PERCENT = 1;
/** The largest file `discover/file` hands a download URL for: a file read to understand it, not to import it. */
export const CONTENT_SOURCE_FILE_READ_MAX_BYTES = 20 * 1024 * 1024;

/** A folder of an external content system whose files are synced into the project without copies. */
export type ExternalContentSource = Wire.ExternalContentSource;
export type SharePointContentSource = Wire.SharePointContentSource;
export type GoogleDriveContentSourcePermissions = Wire.GoogleDriveContentSourcePermissions;
export type SingleGoogleDriveSelection = Wire.SingleGoogleDriveSelection;
export type AllGoogleDrivesSelection = Wire.AllGoogleDrivesSelection;
export type GoogleDrivePermissionOptions = Wire.GoogleDrivePermissionOptions;
export type SharePointPermissionOptions = Wire.SharePointPermissionOptions;
export type GoogleDriveSelection = Wire.GoogleDriveSelection;
export type GoogleDriveReaderConfig = Wire.GoogleDriveReaderConfig;
export type GoogleDriveReader = Wire.GoogleDriveReader;
export type GoogleDriveContentSource = Wire.GoogleDriveContentSource;
export type CreateGoogleDriveContentSourcePayload = Wire.CreateGoogleDriveContentSourcePayload;
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
export type DiscoverContentSourceFilePayload = Wire.DiscoverContentSourceFilePayload;
export type InspectContentSourceFilePayload = Wire.InspectContentSourceFilePayload;
/** A file of the system to read without importing it: its metadata, and a short-lived URL to download it. */
export type ContentSourceFileDownload = Wire.ContentSourceFileDownload;
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
