import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ContentSourceRootsDiscovery,
    GoogleDriveReader,
    GoogleDriveReaderConfig,
    SuccessResponse,
} from '@vertesia/common';

export class GoogleDriveReadersApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/google-drive-readers');
    }

    configure(payload: GoogleDriveReaderConfig): Promise<GoogleDriveReader> {
        return this.post('/', { payload });
    }

    drives(id: string): Promise<ContentSourceRootsDiscovery> {
        return this.get(`/${encodeURIComponent(id)}/drives`);
    }

    disconnect(id: string): Promise<SuccessResponse> {
        return this.del(`/${encodeURIComponent(id)}`);
    }
}
