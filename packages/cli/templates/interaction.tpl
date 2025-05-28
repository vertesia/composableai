//#export {{projectId}} {{id}} @{{date}}
// This is a generated file. Do not edit.

import { InteractionBase, VertesiaClient, VertesiaClientProps } from "@vertesia/client";

{{types}}
/**
 * {{doc}}
 */
export class {{className}} extends InteractionBase<{{inputType}}, {{outputType}}> {
    readonly projectId = "{{projectId}}";
    constructor(clientOrProps: VertesiaClient | VertesiaClientProps) {
        super ("{{id}}", clientOrProps);
        this.client.project = this.projectId;
    }
}
