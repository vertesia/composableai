import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { ListEventDeliveriesPayload, ListEventDeliveriesResponse } from '@vertesia/common';
import { EventIngestChannelsApi } from './EventIngestChannelsApi.js';
import { EventSubscriptionsApi } from './EventSubscriptionsApi.js';

export class EventsApi extends ApiTopic {
    readonly subscriptions: EventSubscriptionsApi;
    readonly channels: EventIngestChannelsApi;

    constructor(parent: ClientBase) {
        super(parent, '/api/v1/events');
        this.subscriptions = new EventSubscriptionsApi(parent);
        this.channels = new EventIngestChannelsApi(parent);
    }

    searchDeliveries(payload: ListEventDeliveriesPayload = {}): Promise<ListEventDeliveriesResponse> {
        return this.post('/deliveries/search', { payload });
    }
}
