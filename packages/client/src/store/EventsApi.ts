import { ApiTopic, ClientBase, ServerSentEvent } from "@vertesia/api-fetch-client";
import {
    EmitEventRequest,
    EmitEventResponse,
    EventCategory,
    EventType,
} from "@vertesia/common";

/**
 * Options for subscribing to events.
 */
export interface SubscribeOptions {
    /** Event categories to subscribe to (default: all) */
    categories?: EventCategory[];
    /** Event types to subscribe to (default: all) */
    eventTypes?: EventType[];
}

/**
 * Client API for emitting and subscribing to events.
 *
 * Events trigger webhook deliveries to subscribed endpoints.
 * This API is primarily used for testing and manual event emission.
 * In production, events are typically emitted by activities within workflows.
 */
export class EventsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/events");
    }

    /**
     * Emit an event to trigger webhook deliveries.
     *
     * This starts the EventDeliveryWorkflow which delivers the event
     * to all matching webhook subscriptions.
     *
     * @param request - Event details including type and payload
     * @returns Object with accepted status and event ID
     *
     * @example
     * ```typescript
     * const result = await client.events.emit({
     *   type: EventType.AskUserRequested,
     *   payload: {
     *     askId: 'ask_123',
     *     runId: 'run_456',
     *     workflowId: 'workflow:789',
     *     agentName: 'MyAgent',
     *     questions: [{ id: 'q1', question: 'What color?' }]
     *   },
     *   metadata: {
     *     agentName: 'MyAgent'
     *   }
     * });
     * ```
     */
    emit(request: EmitEventRequest): Promise<EmitEventResponse> {
        return this.post("/emit", { payload: request });
    }

    /**
     * Get the list of supported event types and categories.
     *
     * @returns Object with arrays of event types and categories
     */
    listTypes(): Promise<{ types: EventType[]; categories: EventCategory[] }> {
        return this.get("/types");
    }

    /**
     * Subscribe to events via Server-Sent Events (SSE).
     *
     * Opens a persistent connection to receive real-time events.
     * Returns a ReadableStream of ServerSentEvents.
     *
     * @param options - Filter options for which events to receive
     * @returns ReadableStream of ServerSentEvents
     *
     * @example
     * ```typescript
     * const stream = await client.events.subscribe({
     *   categories: [EventCategory.AskUser],
     * });
     *
     * const reader = stream.getReader();
     * while (true) {
     *   const { done, value } = await reader.read();
     *   if (done) break;
     *   if (value.type === 'event' && value.data) {
     *     const event = JSON.parse(value.data);
     *     console.log('Received event:', event.type, event.payload);
     *   }
     * }
     * ```
     */
    subscribe(options?: SubscribeOptions): Promise<ReadableStream<ServerSentEvent>> {
        // Build query params
        const query: Record<string, string> = {};
        if (options?.categories) {
            query.categories = options.categories.join(',');
        }
        if (options?.eventTypes) {
            query.eventTypes = options.eventTypes.join(',');
        }

        return this.get("/subscribe", { query, reader: 'sse' });
    }
}
