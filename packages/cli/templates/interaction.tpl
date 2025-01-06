//#export {{projectId}} {{id}} @{{date}}
// This is a generated file. Do not edit.

import { InteractionBase, StudioClient, StudioClientProps } from "@vertesia/client";

{{types}}
/**
 * {{doc}}
 */
export class {{className}} extends InteractionBase<{{inputType}}, {{outputType}}> {
    readonly projectId = "{{projectId}}";
    constructor(clientOrProps: StudioClient | StudioClientProps) {
        super ("{{id}}", clientOrProps);
        this.client.project = this.projectId;
    }
}
