import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateEventIngestChannelPayload,
    DeleteCountResult,
    EventIngestChannel,
    EventIngestChannelMutationResponse,
    ListEventIngestChannelsQuery,
    UpdateEventIngestChannelPayload,
} from '@vertesia/common';

function toQueryRecord(query?: ListEventIngestChannelsQuery): Record<string, string> | undefined {
    if (!query) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        out[key] = Array.isArray(value) ? value.join(',') : String(value);
    }
    return Object.keys(out).length ? out : undefined;
}

export class EventIngestChannelsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/events/channels');
    }

    list(query?: ListEventIngestChannelsQuery): Promise<EventIngestChannel[]> {
        return this.get('/', { query: toQueryRecord(query) });
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
