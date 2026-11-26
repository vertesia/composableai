import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ContentSourceFoldersDiscovery,
    ContentSourceReport,
    ContentSourceReportQuery,
    ContentSourceRootsDiscovery,
    ContentSourceSampleDiscovery,
    ContentSourceSchemaDiscovery,
    ContentSourceSiteDiscovery,
    ContentSourceStatus,
    ContentSourceSummary,
    CreateContentSourcePayload,
    DeleteCountResult,
    DiscoverContentSourceFoldersPayload,
    DiscoverContentSourceSamplePayload,
    DiscoverContentSourceSchemaPayload,
    DiscoverContentSourceSitePayload,
    ExternalContentSource,
    InspectContentSourceFoldersPayload,
    InspectContentSourceSamplePayload,
    InspectContentSourceSchemaPayload,
    SyncContentSourcePayload,
    UpdateContentSourcePayload,
} from '@vertesia/common';

/**
 * Folders of external content systems (SharePoint, Box) synced into the project without copies. Each source has
 * a sync that imports the folder, then reads its changes on a schedule or on request.
 */
export class ContentSourcesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/content-sources');
    }

    list(): Promise<ExternalContentSource[]> {
        return this.get('/');
    }

    /**
     * Every source with what it syncs (site, library, folder) and how its sync stands: state, schedule, last
     * successful round. Needs only content read access, and holds no connection or permission settings.
     */
    summary(): Promise<ContentSourceSummary[]> {
        return this.get('/summary');
    }

    retrieve(id: string): Promise<ExternalContentSource> {
        return this.get(`/${id}`);
    }

    /** Checks the folder with the system and registers the source. Nothing is imported until `sync` is called. */
    create(payload: CreateContentSourcePayload): Promise<ExternalContentSource> {
        return this.post('/', { payload });
    }

    /** Changes the name, description or sync settings, and, before the first sync, the root and folder. */
    update(id: string, payload: UpdateContentSourcePayload): Promise<ExternalContentSource> {
        return this.put(`/${id}`, { payload });
    }

    /** Stops the sync and removes the source. Synced documents are kept. */
    delete(id: string): Promise<DeleteCountResult> {
        return this.del(`/${id}`);
    }

    /** Syncs now: reads the changes, or, with `full`, lists the whole folder and removes deleted files. */
    sync(id: string, payload: SyncContentSourcePayload = {}): Promise<ContentSourceStatus> {
        return this.post(`/${id}/sync`, { payload });
    }

    reconcileDrives(id: string, payload: SyncContentSourcePayload): Promise<{ success: boolean }> {
        return this.post(`/${encodeURIComponent(id)}/reconcile-drives`, { payload });
    }

    /** The sync's state: the current and last rounds, and when the next one starts. */
    status(id: string): Promise<ContentSourceStatus> {
        return this.get(`/${id}/status`);
    }

    /**
     * A page of what a sync round did with each file: created, updated, deleted, skipped or failed. Round IDs are in
     * the status's `recent_rounds`. Pass the `next_cursor` of a page to read the next one.
     */
    report(id: string, roundId: string, query: ContentSourceReportQuery = {}): Promise<ContentSourceReport> {
        return this.get(`/${id}/rounds/${encodeURIComponent(roundId)}/report`, { query: { ...query } });
    }

    /**
     * Resolves a site through an OAuth provider and lists its document libraries. Works before a source exists,
     * so it also tells whether the connection is set up correctly.
     */
    discoverSite(payload: DiscoverContentSourceSitePayload): Promise<ContentSourceSiteDiscovery> {
        return this.post('/discover/site', { payload });
    }

    /** The direct subfolders of a folder of a document library, to browse to the folder to sync. */
    discoverFolders(payload: DiscoverContentSourceFoldersPayload): Promise<ContentSourceFoldersDiscovery> {
        return this.post('/discover/folders', { payload });
    }

    /** The content types of a document library with their columns, and the library's own columns. */
    discoverSchema(payload: DiscoverContentSourceSchemaPayload): Promise<ContentSourceSchemaDiscovery> {
        return this.post('/discover/schema', { payload });
    }

    /**
     * A bounded sample of the files under a folder, with each file's content type and column values. The sample is
     * spread over subfolders; `truncated` says whether the folder holds more than was read.
     */
    discoverSample(payload: DiscoverContentSourceSamplePayload): Promise<ContentSourceSampleDiscovery> {
        return this.post('/discover/sample', { payload });
    }

    /**
     * What a source's connection reaches: the document libraries of its SharePoint site, or the Box folders shared
     * with its app. The caller names no OAuth provider or address: the source holds them.
     */
    inspectRoots(id: string): Promise<ContentSourceRootsDiscovery> {
        return this.post(`/${id}/discover/roots`);
    }

    /** The direct subfolders of a folder the source reaches, at the top of its root by default. */
    inspectFolders(
        id: string,
        payload: InspectContentSourceFoldersPayload = {},
    ): Promise<ContentSourceFoldersDiscovery> {
        return this.post(`/${id}/discover/folders`, { payload });
    }

    /** The content types (SharePoint) or metadata templates (Box) and their columns. */
    inspectSchema(id: string, payload: InspectContentSourceSchemaPayload = {}): Promise<ContentSourceSchemaDiscovery> {
        return this.post(`/${id}/discover/schema`, { payload });
    }

    /** A bounded sample of the files under a folder the source reaches, its own folder by default. */
    inspectSample(id: string, payload: InspectContentSourceSamplePayload = {}): Promise<ContentSourceSampleDiscovery> {
        return this.post(`/${id}/discover/sample`, { payload });
    }
}
