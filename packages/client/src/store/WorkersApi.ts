import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { CreateWorkerDeploymentRequest } from "@vertesia/common";


export class WorkersApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/workers");
    }

    async deploy(payload: CreateWorkerDeploymentRequest): Promise<void> {
        return this.post('/', {
            payload
        });
    }

}
