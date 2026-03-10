import { log } from "@temporalio/activity";
import {
    DSLActivityExecutionPayload,
    RemoteActivityExecutionPayload,
    RemoteActivityExecutionResponse,
} from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

/**
 * Parameters for the executeRemoteActivity bridge activity.
 */
export interface ExecuteRemoteActivityParams {
    /** URL of the remote activity endpoint on the tool server */
    url: string;
    /** The activity name (unprefixed, as known by the tool server) */
    activity_name: string;
    /** The resolved parameters for the activity */
    params: Record<string, any>;
    /** App installation ID */
    app_install_id: string;
    /** App name */
    app_name: string;
    /** App installation settings */
    app_settings?: Record<string, any>;
}

/**
 * Bridge activity that executes a remote activity on a tool server via HTTP POST.
 *
 * This activity is called by the DSL workflow engine when a step's name matches
 * a remote activity (qualified as `app:<app_name>:<collection>:<activity>`). It POSTs a
 * `RemoteActivityExecutionPayload` to the tool server and returns the result.
 *
 * Network errors throw (so Temporal retries). HTTP errors return the error.
 */
export async function executeRemoteActivity(
    payload: DSLActivityExecutionPayload<ExecuteRemoteActivityParams>,
): Promise<any> {
    const ctx = await setupActivity<ExecuteRemoteActivityParams>(payload);
    const { params, runId } = ctx;
    const { url, activity_name, params: activityParams, app_install_id, app_settings } = params;

    const executionPayload: RemoteActivityExecutionPayload = {
        activity_name,
        params: activityParams,
        metadata: {
            run_id: runId,
            app_install_id,
            app_settings,
            endpoints: payload.config ? {
                studio: payload.config.studio_url,
                store: payload.config.store_url,
            } : undefined,
        },
    };

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${payload.auth_token}`,
            },
            body: JSON.stringify(executionPayload),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn("Failed to reach remote activity endpoint", {
            error: message, activity: activity_name, endpoint: url, runId, app_install_id,
        });
        // Network-level failure — let Temporal retry
        throw new Error(`Failed to reach remote activity endpoint (activity: ${activity_name}, endpoint: ${url}): ${message}`);
    }

    const responseText = await response.text();

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;
        try {
            const errorJson = JSON.parse(responseText) as RemoteActivityExecutionResponse;
            if (errorJson.error) {
                errorMessage = errorJson.error;
            }
        } catch {
            // Not JSON — use the status line
        }
        log.warn("Remote activity returned HTTP error", {
            activity: activity_name, endpoint: url, status: response.status, runId, app_install_id,
            responsePreview: responseText.slice(0, 500),
        });
        throw new Error(`Remote activity ${activity_name} failed: ${errorMessage}`);
    }

    let responseJson: RemoteActivityExecutionResponse;
    try {
        responseJson = JSON.parse(responseText);
    } catch (err: unknown) {
        const preview = responseText.length > 200 ? responseText.slice(0, 200) + '...' : responseText;
        log.warn("Invalid JSON response from remote activity", {
            activity: activity_name, endpoint: url, runId, app_install_id,
            responsePreview: preview,
        });
        throw new Error(`Remote activity ${activity_name} returned invalid JSON: ${preview}`);
    }

    if (responseJson.is_error) {
        log.warn("Remote activity returned error", {
            activity: activity_name, endpoint: url, error: responseJson.error, runId, app_install_id,
        });
        throw new Error(`Remote activity ${activity_name}: ${responseJson.error}`);
    }

    return responseJson.result;
}
