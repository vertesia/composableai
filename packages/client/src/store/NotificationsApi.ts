import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ArchiveNotificationsPayload,
    ListNotificationsQuery,
    ListNotificationsResponse,
    MarkAllNotificationsReadPayload,
    MarkNotificationsReadPayload,
    MarkNotificationsSeenPayload,
    Notification,
    NotificationCounts,
    NotificationPreferences,
    NotificationStreamEvent,
    NotificationUpdateResult,
} from '@vertesia/common';
import {
    type ManagedEventSourceConnection,
    type ManagedEventSourceStatus,
    openManagedEventSource,
} from '../managed-sse.js';

export interface SubscribeNotificationsOptions {
    signal?: AbortSignal;
    max_reconnect_attempts?: number;
    /** Called when the inbox changed: fetch the counts and the newest page again. */
    on_changed: (event: NotificationStreamEvent) => void;
    /** Called once the stream is connected, after every reconnect, so the caller can fetch a snapshot. */
    on_open?: () => void;
    on_error?: (error: unknown) => void;
    on_status?: (status: ManagedEventSourceStatus) => void;
}

/**
 * The current user's notification inbox in the current project. Every method is scoped by the
 * caller's authentication: there is no way to read or change another user's notifications.
 */
export class NotificationsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/notifications');
    }

    list(query: ListNotificationsQuery = {}): Promise<ListNotificationsResponse> {
        return this.get('/', { query });
    }

    retrieve(id: string): Promise<Notification> {
        return this.get(`/${id}`);
    }

    counts(): Promise<NotificationCounts> {
        return this.get('/counts');
    }

    /** Marks notifications displayed in an open inbox list as seen, which clears the badge. */
    markSeen(payload: MarkNotificationsSeenPayload): Promise<NotificationUpdateResult> {
        return this.post('/seen', { payload });
    }

    /**
     * Marks notifications read, by id or by the exact occurrence the client rendered. An occurrence with
     * no notification yet is held and applied when its notification is written.
     */
    markRead(payload: MarkNotificationsReadPayload): Promise<NotificationUpdateResult> {
        return this.post('/read', { payload });
    }

    /** Marks read every notification written up to `before`, the `read_all_before` of a list. */
    markAllRead(payload: MarkAllNotificationsReadPayload): Promise<NotificationUpdateResult> {
        return this.post('/read-all', { payload });
    }

    archive(payload: ArchiveNotificationsPayload): Promise<NotificationUpdateResult> {
        return this.post('/archive', { payload });
    }

    getPreferences(): Promise<NotificationPreferences> {
        return this.get('/preferences');
    }

    updatePreferences(payload: NotificationPreferences): Promise<NotificationPreferences> {
        return this.put('/preferences', { payload });
    }

    /**
     * Opens the change stream. The stream carries no notification content: on every `changed` event
     * (and on `on_open`, after a reconnect) fetch the counts and the newest page again.
     */
    subscribe(options: SubscribeNotificationsOptions): ManagedEventSourceConnection {
        const { signal, max_reconnect_attempts, on_changed, on_open, on_error, on_status } = options;
        return openManagedEventSource<NotificationStreamEvent>({
            url: () => new URL(`${this.baseUrl}/stream`),
            event_types: ['changed', 'ready'],
            signal,
            max_reconnect_attempts,
            get_access_token: async () => {
                const client = this.client as ClientBase & { _auth?: () => Promise<string> };
                return client._auth ? await client._auth() : undefined;
            },
            on_error,
            on_status,
            on_event: ({ data, event_type }) => {
                if (event_type === 'ready') {
                    on_open?.();
                } else if (data.type === 'changed') {
                    on_changed(data);
                }
            },
        });
    }
}
