import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    EventDeliveryQueueSummaryPayload,
    EventDeliveryQueueSummaryResponse,
    EventDeliveryStreamEnvelope,
    EventDeliveryStreamItem,
    EventDeliveryStreamSnapshot,
    EventDeliveryStreamUpdate,
    ListEventDeliveriesPayload,
    ListEventDeliveriesResponse,
    StreamEventDeliveriesQuery,
} from '@vertesia/common';
import {
    type ManagedEventSourceConnection,
    type ManagedEventSourceStatus,
    openManagedEventSource,
} from '../managed-sse.js';
import { EventIngestChannelsApi } from './EventIngestChannelsApi.js';
import { EventSubscriptionsApi } from './EventSubscriptionsApi.js';

export interface SubscribeEventDeliveriesOptions extends StreamEventDeliveriesQuery {
    signal?: AbortSignal;
    max_reconnect_attempts?: number;
    on_snapshot?: (deliveries: EventDeliveryStreamItem[], envelope: EventDeliveryStreamSnapshot) => void;
    on_delivery?: (delivery: EventDeliveryStreamItem, envelope: EventDeliveryStreamUpdate) => void;
    on_envelope?: (envelope: EventDeliveryStreamEnvelope) => void;
    on_error?: (error: unknown) => void;
    on_status?: (status: ManagedEventSourceStatus) => void;
}

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

    queueSummary(payload: EventDeliveryQueueSummaryPayload = {}): Promise<EventDeliveryQueueSummaryResponse> {
        return this.post('/deliveries/queue-summary', { payload });
    }

    subscribeDeliveries(options: SubscribeEventDeliveriesOptions): ManagedEventSourceConnection {
        const { signal, max_reconnect_attempts, on_snapshot, on_delivery, on_envelope, on_error, on_status, ...query } =
            options;

        return openManagedEventSource<EventDeliveryStreamEnvelope>({
            url: () => this.buildStreamUrl(query),
            event_types: ['snapshot', 'event', 'heartbeat', 'error'],
            signal,
            max_reconnect_attempts,
            last_event_id_query_param: 'since_event_id',
            get_access_token: async () => {
                const client = this.client as ClientBase & { _auth?: () => Promise<string> };
                return client._auth ? await client._auth() : undefined;
            },
            get_cursor: (envelope) => envelope.cursor,
            on_status,
            on_error,
            on_event: ({ data }) => {
                on_envelope?.(data);
                if (data.type === 'snapshot') {
                    on_snapshot?.(data.deliveries, data);
                } else if (data.type === 'event') {
                    on_delivery?.(data.item, data);
                } else if (data.type === 'error') {
                    on_error?.(new Error(data.error));
                }
            },
        });
    }

    private buildStreamUrl(query: StreamEventDeliveriesQuery): URL {
        const url = new URL(`${this.baseUrl}/stream`);
        this.setStreamParam(url, 'limit', query.limit);
        this.setStreamParam(url, 'event_id', query.event_id);
        this.setStreamParam(url, 'resource_id', query.resource_id);
        this.setStreamListParam(url, 'resource_type', query.resource_type);
        this.setStreamListParam(url, 'event_category', query.event_category);
        this.setStreamListParam(url, 'action', query.action);
        this.setStreamListParam(url, 'outbox_status', query.outbox_status);
        this.setStreamParam(url, 'since_event_id', query.since_event_id);
        this.setStreamParam(url, 'since_created_at', query.since_created_at);
        this.setStreamParam(url, 'include_event', query.include_event);
        this.setStreamParam(url, 'poll_interval_ms', query.poll_interval_ms);
        return url;
    }

    private setStreamParam(url: URL, key: string, value: string | number | boolean | undefined): void {
        if (value === undefined || value === null || value === '') {
            return;
        }
        url.searchParams.set(key, String(value));
    }

    private setStreamListParam(url: URL, key: string, value: string[] | undefined): void {
        if (!value?.length) {
            return;
        }
        url.searchParams.set(key, value.join(','));
    }
}
