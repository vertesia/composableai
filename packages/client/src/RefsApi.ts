import type { ResolvableRef, ResourceRef } from "@vertesia/common"
import { ApiTopic, type ClientBase } from "@vertesia/api-fetch-client"


export class RefsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/refs")
    }


    resolve(refs: ResolvableRef[]): Promise<ResourceRef[]> {

        return this.post('/resolve', { payload: { refs } })

    }

}
