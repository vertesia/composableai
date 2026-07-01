import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateEventSubscriptionPayload,
    DeleteCountResult,
    EventSubscription,
    EventSubscriptionMutationResponse,
    ListEventSubscriptionsQuery,
    UpdateEventSubscriptionPayload,
} from '@vertesia/common';

function toQueryRecord(query?: ListEventSubscriptionsQuery): Record<string, string> | undefined {
    if (!query) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            if (value.length === 0) continue;
            out[key] = value.join(',');
        } else {
            out[key] = String(value);
        }
    }
    return Object.keys(out).length ? out : undefined;
}

export class EventSubscriptionsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/events/subscriptions');
    }

    list(query?: ListEventSubscriptionsQuery): Promise<EventSubscription[]> {
        return this.get('/', { query: toQueryRecord(query) });
    }

    retrieve(id: string): Promise<EventSubscription> {
        return this.get(`/${id}`);
    }

    create(payload: CreateEventSubscriptionPayload): Promise<EventSubscriptionMutationResponse> {
        return this.post('/', { payload });
    }

    update(id: string, payload: UpdateEventSubscriptionPayload): Promise<EventSubscriptionMutationResponse> {
        return this.put(`/${id}`, { payload });
    }

    delete(id: string): Promise<DeleteCountResult> {
        return this.del(`/${id}`);
    }
}
