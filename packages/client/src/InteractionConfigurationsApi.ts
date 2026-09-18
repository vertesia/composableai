import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { InteractionConfigurationResult, UpdateInteractionConfigurationPayload } from '@vertesia/common';

export default class InteractionConfigurationsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/interaction-configurations');
    }
    retrieve(interactionId: string): Promise<InteractionConfigurationResult> {
        return this.get(`/${encodeURIComponent(interactionId)}`);
    }
    update(
        interactionId: string,
        payload: UpdateInteractionConfigurationPayload,
    ): Promise<InteractionConfigurationResult> {
        return this.put(`/${encodeURIComponent(interactionId)}`, { payload });
    }
    delete(interactionId: string): Promise<InteractionConfigurationResult> {
        return this.del(`/${encodeURIComponent(interactionId)}`);
    }
}
