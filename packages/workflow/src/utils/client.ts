/**
 * get a zeno client for a given token
 */

import { VertesiaClient } from "@vertesia/client";
import { WorkflowExecutionBaseParams } from "@vertesia/common";
import { WorkflowParamNotFoundError } from "../errors.js";

export function getVertesiaClient(payload: WorkflowExecutionBaseParams) {
    if (!payload.auth_token) {
        throw new WorkflowParamNotFoundError(
            "Authentication Token is missing from WorkflowExecutionPayload.authToken",
        );
    }

    return VertesiaClient.fromAuthToken(payload.auth_token);
}
