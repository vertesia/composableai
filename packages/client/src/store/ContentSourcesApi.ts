import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ContentSourceStatus,
    CreateContentSourcePayload,
    DeleteCountResult,
    ExternalContentSource,
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

    retrieve(id: string): Promise<ExternalContentSource> {
        return this.get(`/${id}`);
    }

    /** Checks the folder with the system, registers the source and starts its first sync. */
    create(payload: CreateContentSourcePayload): Promise<ExternalContentSource> {
        return this.post('/', { payload });
    }

    /** Changes the name, description or sync settings. */
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

    /** The sync's state: the current and last rounds, and when the next one starts. */
    status(id: string): Promise<ContentSourceStatus> {
        return this.get(`/${id}/status`);
    }
}
