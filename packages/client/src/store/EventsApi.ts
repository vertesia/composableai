import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import { EventSubscriptionsApi } from './EventSubscriptionsApi.js';

export class EventsApi extends ApiTopic {
    readonly subscriptions: EventSubscriptionsApi;

    constructor(parent: ClientBase) {
        super(parent, '/api/v1/events');
        this.subscriptions = new EventSubscriptionsApi(parent);
    }
}
