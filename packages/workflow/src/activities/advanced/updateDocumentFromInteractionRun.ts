import { InteractionOutput } from "@vertesia/client";
import { DSLActivityExecutionPayload, DSLActivitySpec, ExecutionRun } from "@vertesia/common";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { ActivityParamNotFoundError } from "../../errors.js";


export interface UpdateDocumentFromInteractionRunParams {
    /**
     * The execution run object to use. Required.
     * Not required in params since it is usually fetched
     */
    run?: ExecutionRun,
}

export interface UpdateDocumentFromInteractionRun extends DSLActivitySpec<UpdateDocumentFromInteractionRunParams> {
    name: 'updateDocumentFromInteractionRun';
}

export async function updateDocumentFromInteractionRun(payload: DSLActivityExecutionPayload<UpdateDocumentFromInteractionRunParams>) {
    const { params, client, objectId } = await setupActivity<UpdateDocumentFromInteractionRunParams>(payload);

    if (!params.run) {
        throw new ActivityParamNotFoundError("run", payload.activity);
    }

    const docProps = InteractionOutput.from(params.run.result).object();

    if (!docProps) {
        return { status: "failed", error: "no-props" };
    }

    await client.objects.update(objectId, docProps);

    return { status: "success" };
}