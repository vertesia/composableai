import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    CreateSubscriptionRequest,
    ListSubscriptionsResponse,
    RotateSecretResponse,
    TestWebhookResponse,
    UpdateSubscriptionRequest,
    WebhookSubscription,
} from "@vertesia/common";

/**
 * Client API for managing webhook subscriptions.
 *
 * Subscriptions allow external systems to receive webhook notifications
 * for events such as ask_user requests and agent run lifecycle events.
 */
export class SubscriptionsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/subscriptions");
    }

    /**
     * List all webhook subscriptions in the project.
     */
    list(): Promise<ListSubscriptionsResponse> {
        return this.get("/");
    }

    /**
     * Retrieve a subscription by ID.
     */
    retrieve(id: string): Promise<WebhookSubscription> {
        return this.get(`/${id}`);
    }

    /**
     * Create a new webhook subscription.
     *
     * @param payload - Subscription configuration including name, URL, and event types
     * @returns The created subscription (with secret visible if generateSecret was true)
     *
     * @example
     * ```typescript
     * const subscription = await client.subscriptions.create({
     *   name: 'My Webhook',
     *   url: 'https://example.com/webhook',
     *   eventTypes: [EventType.AskUserRequested, EventType.AgentRunCompleted],
     *   generateSecret: true,
     *   filters: {
     *     agentNames: ['MyAgent'],
     *     interactive: true
     *   }
     * });
     * ```
     */
    create(payload: CreateSubscriptionRequest): Promise<WebhookSubscription> {
        return this.post("/", { payload });
    }

    /**
     * Update an existing subscription.
     *
     * @param id - Subscription ID
     * @param payload - Fields to update
     * @returns The updated subscription
     */
    update(id: string, payload: UpdateSubscriptionRequest): Promise<WebhookSubscription> {
        return this.put(`/${id}`, { payload });
    }

    /**
     * Delete a subscription.
     *
     * @param id - Subscription ID
     * @returns Object with the deleted subscription ID
     */
    delete(id: string): Promise<{ id: string; deleted: boolean }> {
        return this.del(`/${id}`);
    }

    /**
     * Rotate the webhook secret.
     *
     * This generates a new Svix-compatible secret for the subscription.
     * The new secret is only returned once, so store it securely.
     *
     * @param id - Subscription ID
     * @returns Object with the new secret
     */
    rotateSecret(id: string): Promise<RotateSecretResponse> {
        return this.post(`/${id}/rotate-secret`, {});
    }

    /**
     * Test a webhook subscription by sending a test event.
     *
     * This sends a test.ping event to the subscription URL and returns
     * the delivery result including status code and latency.
     *
     * @param id - Subscription ID
     * @returns Test result with success status, status code, and latency
     */
    test(id: string): Promise<TestWebhookResponse> {
        return this.post(`/${id}/test`, {});
    }
}
