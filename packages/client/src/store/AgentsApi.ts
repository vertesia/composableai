import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { CreateAgentDeploymentRequest } from "@vertesia/common";


export class AgentsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/agents");
    }

    async deploy(payload: CreateAgentDeploymentRequest): Promise<void> {
        return this.post('/', {
            payload
        });
    }

}
