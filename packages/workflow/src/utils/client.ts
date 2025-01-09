/**
 * get a zeno client for a given token
 */

import { VertesiaClient } from "@vertesia/client";
import { WorkflowExecutionPayload } from "@vertesia/common";


export function getClient(payload: WorkflowExecutionPayload) {

    if (!payload.auth_token) {
        throw new Error("Authentication Token is missing from WorkflowExecutionPayload.authToken");
    }

    if (!payload.config?.studio_url) {
        throw new Error("Content Store URL is missing from WorkflowExecutionPayload.servers.storeUrl");
    }

    if (!payload.config?.store_url) {
        throw new Error("Content Store URL is missing from WorkflowExecutionPayload.servers.storeUrl");
    }

    const client = new VertesiaClient({
        serverUrl: payload.config.studio_url,
        storeUrl: payload.config.store_url,
        apikey: payload.auth_token
    });

    return client;

}