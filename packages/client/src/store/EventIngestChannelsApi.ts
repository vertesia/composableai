import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateEventIngestChannelPayload,
    DeleteCountResult,
    EventIngestChannel,
    EventIngestChannelMutationResponse,
    UpdateEventIngestChannelPayload,
} from '@vertesia/common';

export class EventIngestChannelsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/events/channels');
    }

    list(): Promise<EventIngestChannel[]> {
        return this.get('/');
    }

    retrieve(id: string): Promise<EventIngestChannel> {
        return this.get(`/${id}`);
    }

    create(payload: CreateEventIngestChannelPayload): Promise<EventIngestChannelMutationResponse> {
        return this.post('/', { payload });
    }

    update(id: string, payload: UpdateEventIngestChannelPayload): Promise<EventIngestChannelMutationResponse> {
        return this.put(`/${id}`, { payload });
    }

    delete(id: string): Promise<DeleteCountResult> {
        return this.del(`/${id}`);
    }
}
