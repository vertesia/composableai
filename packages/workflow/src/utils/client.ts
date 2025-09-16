/**
 * get a zeno client for a given token
 */

import {
    decodeJWT,
    VertesiaClient,
    VertesiaClientProps,
} from "@vertesia/client";
import { WorkflowExecutionBaseParams } from "@vertesia/common";
import { WorkflowParamNotFoundError } from "../errors.js";

export function getVertesiaClient(payload: WorkflowExecutionBaseParams) {
    return new VertesiaClient(getVertesiaClientOptions(payload));
}

export function getVertesiaClientOptions(
    payload: WorkflowExecutionBaseParams,
): VertesiaClientProps {
    if (!payload.auth_token) {
        throw new WorkflowParamNotFoundError(
            "Authentication Token is missing from WorkflowExecutionPayload.authToken",
        );
    }

    const authToken = decodeJWT(payload.auth_token);
    if (!authToken) {
        throw new WorkflowParamNotFoundError("Authentication Token is invalid");
    }
    if (!authToken.iss) {
        throw new WorkflowParamNotFoundError(
            "Authentication Token is invalid: no iss",
        );
    }

    if (!payload.config?.studio_url) {
        throw new WorkflowParamNotFoundError(
            "Content Store URL is missing from WorkflowExecutionPayload",
        );
    }

    if (!payload.config?.store_url) {
        throw new WorkflowParamNotFoundError(
            "Content Store URL is missing from WorkflowExecutionPayload",
        );
    }

    return {
        serverUrl: payload.config.studio_url,
        storeUrl: payload.config.store_url,
        tokenServerUrl: authToken.iss,
        apikey: payload.auth_token,
    };
}
