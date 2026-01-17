import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

export class BatchApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/batch");
    }
}
