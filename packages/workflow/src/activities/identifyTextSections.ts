import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { InteractionExecutionParams } from "./executeInteraction.js";

export interface identifyTextSectionsParams extends InteractionExecutionParams {
    interactionName?: string;
}

export interface identifyTextSections extends DSLActivitySpec<identifyTextSectionsParams> {
    name: "identifyTextSections";
}

export async function identifyTextSections(
    _payload: DSLActivityExecutionPayload<identifyTextSectionsParams>,
) {
    return;
};