/**
 * get a zeno client for a given token
 */

import { decodeJWT, VertesiaClient, type VertesiaClientProps } from '@vertesia/client';
import type { WorkflowExecutionBaseParams } from '@vertesia/common';
import { WorkflowParamNotFoundError } from '../errors.js';

// Short default timeout for ordinary workflow -> server/store calls (object GETs, status updates,
// etc.). A stale/dead pooled connection (a server pod scaled down/rolled mid-request) used to hang
// for the whole 30-minute undici headersTimeout; this bounds it to seconds so it fails fast and the
// activity is retried. The long path — synchronous interaction execution, which blocks on the model —
// sets its own long per-request timeout in @vertesia/client (executeInteraction*), overriding this.
// Override the default via VERTESIA_WORKFLOW_FETCH_TIMEOUT_MS (0/false disables it).
const DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS = 60 * 1000;
const WORKFLOW_FETCH_TIMEOUT_ENV = 'VERTESIA_WORKFLOW_FETCH_TIMEOUT_MS';

export function getVertesiaClient(payload: WorkflowExecutionBaseParams<unknown>) {
    return new VertesiaClient(getVertesiaClientOptions(payload));
}

export function getVertesiaClientOptions(payload: WorkflowExecutionBaseParams<unknown>): VertesiaClientProps {
    if (!payload.auth_token) {
        throw new WorkflowParamNotFoundError('Authentication Token is missing from WorkflowExecutionPayload.authToken');
    }

    if (!payload.config?.studio_url) {
        throw new WorkflowParamNotFoundError(
            'Content Store URL is missing from WorkflowExecutionPayload.servers.storeUrl',
        );
    }

    if (!payload.config?.store_url) {
        throw new WorkflowParamNotFoundError(
            'Content Store URL is missing from WorkflowExecutionPayload.servers.storeUrl',
        );
    }

    const token = decodeJWT(payload.auth_token);

    return {
        serverUrl: payload.config.studio_url,
        storeUrl: payload.config.store_url,
        tokenServerUrl: token.iss,
        apikey: payload.auth_token,
        timeout: parseWorkflowFetchTimeoutMs(),
    };
}

function parseWorkflowFetchTimeoutMs(): number | false {
    const raw = typeof process !== 'undefined' ? process.env?.[WORKFLOW_FETCH_TIMEOUT_ENV] : undefined;
    if (!raw) {
        return DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        // 0 / invalid -> disable the default timeout (rely on per-request / Temporal start-to-close).
        return false;
    }
    return parsed;
}
