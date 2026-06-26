import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateEventSubscriptionPayload,
    DeleteCountResult,
    EventSubscription,
    EventSubscriptionMutationResponse,
    UpdateEventSubscriptionPayload,
} from '@vertesia/common';

export class EventSubscriptionsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/events/subscriptions');
    }

    list(): Promise<EventSubscription[]> {
        return this.get('/');
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
