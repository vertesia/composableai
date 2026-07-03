import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { GenericCommandResponse } from '@vertesia/common';

/**
 * Various utility commands
 */

export default class CommandsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/commands');
    }

    async isNamespaceAvailable(name: string): Promise<boolean> {
        return this.get<{ available: boolean }>(`/namespaces/${name}/is_available`).then(
            (response) => response.available,
        );
    }

    async initSamples(): Promise<GenericCommandResponse> {
        return this.post('/onboarding/init-samples');
    }
}
