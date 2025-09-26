import { DSLActivityExecutionPayload, DSLActivitySpec, ExecutionRun } from "@vertesia/common";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { ActivityParamNotFoundError } from "../../errors.js";
import { parseCompletionResultsToJson } from "@llumiverse/common";


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

    const docProps = params.run.result;

    if (!docProps) {
        return { status: "failed", error: "no-props" };
    }

    const jsonResult = parseCompletionResultsToJson(params.run.result);

    await client.objects.update(objectId, jsonResult);

    return { status: "success" };
}