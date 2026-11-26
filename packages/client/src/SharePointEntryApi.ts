import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { SharePointRegion } from '@vertesia/common';

export default class SharePointEntryApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/sharepoint-entry');
    }

    /** Discover the caller's assigned region with a delegated Microsoft Entra access token. */
    discoverRegion(entraAccessToken: string): Promise<SharePointRegion> {
        return this.get('/region', { headers: { authorization: `Bearer ${entraAccessToken}` } });
    }
}
