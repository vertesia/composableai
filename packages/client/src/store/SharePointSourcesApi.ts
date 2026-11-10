import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { CreateSharePointSourcePayload, DeleteCountResult, SharePointSource } from '@vertesia/common';

/**
 * SharePoint document libraries registered for import. An import itself is a `bulkImportWorkflow`
 * run with `vars.source = { type: 'sharepoint', source_id }`.
 */
export class SharePointSourcesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/sharepoint-sources');
    }

    list(): Promise<SharePointSource[]> {
        return this.get('/');
    }

    retrieve(id: string): Promise<SharePointSource> {
        return this.get(`/${id}`);
    }

    /** Checks the site, library and folder with Microsoft Graph, then registers the source. */
    create(payload: CreateSharePointSourcePayload): Promise<SharePointSource> {
        return this.post('/', { payload });
    }

    /** Removes the source. Documents it imported are kept. */
    delete(id: string): Promise<DeleteCountResult> {
        return this.del(`/${id}`);
    }
}
