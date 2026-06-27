import type { EventDeliveryStreamSnapshot } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from '../client.js';

type Listener = (event: MessageEvent) => void;

class FakeEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    static instances: FakeEventSource[] = [];
    static urls: string[] = [];

    readonly url: string;
    readonly withCredentials = false;
    readyState = FakeEventSource.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    private readonly listeners = new Map<string, Listener[]>();

    constructor(url: string) {
        this.url = url;
        FakeEventSource.urls.push(url);
        FakeEventSource.instances.push(this);
    }

    close() {
        this.readyState = FakeEventSource.CLOSED;
    }

    addEventListener(type: string, listener: Listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener() {}

    dispatchEvent() {
        return true;
    }

    emit(type: string, data: unknown, lastEventId = '') {
        const event = { data: JSON.stringify(data), lastEventId } as MessageEvent;
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
        if (type === 'message') {
            this.onmessage?.(event);
        }
    }
}

function createClient(): VertesiaClient {
    const client = new VertesiaClient({
        serverUrl: 'https://studio.example.test',
        storeUrl: 'https://store.example.test',
    });
    client.withAuthCallback(async () => 'Bearer test-token');
    return client;
}

describe('EventsApi.subscribeDeliveries', () => {
    beforeEach(() => {
        FakeEventSource.instances = [];
        FakeEventSource.urls = [];
        vi.stubGlobal('EventSource', FakeEventSource);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('serializes stream filters and auth token into the EventSource URL', async () => {
        const client = createClient();
        const subscription = client.events.subscribeDeliveries({
            resource_id: 'agentic-coworker-platform',
            resource_type: ['app', 'workflow_run'],
            event_category: ['workflow', 'system'],
            action: ['create', 'workflow_completed'],
            outbox_status: ['failed'],
            include_event: true,
            poll_interval_ms: 1500,
            on_envelope: () => {},
        });

        await vi.waitFor(() => expect(FakeEventSource.urls).toHaveLength(1));
        const url = new URL(FakeEventSource.urls[0]);

        expect(url.href).toContain('https://store.example.test/api/v1/events/stream');
        expect(url.searchParams.get('access_token')).toBe('test-token');
        expect(url.searchParams.get('resource_id')).toBe('agentic-coworker-platform');
        expect(url.searchParams.get('resource_type')).toBe('app,workflow_run');
        expect(url.searchParams.get('event_category')).toBe('workflow,system');
        expect(url.searchParams.get('action')).toBe('create,workflow_completed');
        expect(url.searchParams.get('outbox_status')).toBe('failed');
        expect(url.searchParams.get('include_event')).toBe('true');
        expect(url.searchParams.get('poll_interval_ms')).toBe('1500');

        subscription.close();
    });

    it('dispatches typed snapshot envelopes to the snapshot callback', async () => {
        const client = createClient();
        const snapshots: EventDeliveryStreamSnapshot[] = [];
        const subscription = client.events.subscribeDeliveries({
            resource_id: 'demo-app',
            on_snapshot: (_items, envelope) => snapshots.push(envelope),
        });

        await vi.waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
        FakeEventSource.instances[0].emit(
            'snapshot',
            {
                type: 'snapshot',
                emitted_at: '2026-06-27T00:00:00.000Z',
                cursor: 'evt_1',
                deliveries: [],
            } satisfies EventDeliveryStreamSnapshot,
            'evt_1',
        );

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0].cursor).toBe('evt_1');

        subscription.close();
    });
});
