import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    EventWebhookSigningSecretRequest,
    EventWebhookSigningSecretResponse,
    SignEventWebhookRequest,
    SignEventWebhookResponse,
} from '@vertesia/common';

export default class InternalSecretsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/internal/secrets');
    }

    rotateEventWebhookSigningSecret(
        subscriptionId: string,
        payload: EventWebhookSigningSecretRequest,
    ): Promise<EventWebhookSigningSecretResponse> {
        return this.post(`/event-webhooks/${subscriptionId}/rotate`, { payload });
    }

    deleteEventWebhookSigningSecret(
        subscriptionId: string,
        payload: EventWebhookSigningSecretRequest,
    ): Promise<{ deleted: true }> {
        return this.post(`/event-webhooks/${subscriptionId}/delete`, { payload });
    }

    signEventWebhook(subscriptionId: string, payload: SignEventWebhookRequest): Promise<SignEventWebhookResponse> {
        return this.post(`/event-webhooks/${subscriptionId}/sign`, { payload });
    }
}
