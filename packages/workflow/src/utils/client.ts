/**
 * get a zeno client for a given token
 */

import { activityInfo } from '@temporalio/activity';
import { decodeJWT, VertesiaClient, type VertesiaClientProps } from '@vertesia/client';
import { EVENT_BUS_REQUEST_ORIGIN, REQUEST_ORIGIN_HEADER, type WorkflowExecutionBaseParams } from '@vertesia/common';
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

    let eventRequestSequence = 0;
    let eventRequestPrefix: string | undefined;
    if (payload.request_origin === EVENT_BUS_REQUEST_ORIGIN) {
        try {
            const info = activityInfo();
            const execution = info.workflowExecution;
            if (execution) {
                eventRequestPrefix = `event:${execution.workflowId}:${execution.runId}:${info.activityId}`;
            }
        } catch {
            // Option construction is also used by unit tests outside an activity.
        }
    }

    return {
        serverUrl: payload.config.studio_url,
        storeUrl: payload.config.store_url,
        tokenServerUrl: token.iss,
        apikey: payload.auth_token,
        timeout: parseWorkflowFetchTimeoutMs(),
        ...(payload.request_origin === EVENT_BUS_REQUEST_ORIGIN
            ? {
                  onRequest: (request: Request) => {
                      request.headers.set(REQUEST_ORIGIN_HEADER, EVENT_BUS_REQUEST_ORIGIN);
                      if (eventRequestPrefix) {
                          request.headers.set('x-request-id', `${eventRequestPrefix}:${eventRequestSequence++}`);
                      }
                  },
              }
            : {}),
    };
}

function parseWorkflowFetchTimeoutMs(): number | false {
    const raw = typeof process !== 'undefined' ? process.env?.[WORKFLOW_FETCH_TIMEOUT_ENV] : undefined;
    if (!raw) {
        return DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS;
    }

    // Only an explicit 0/false disables the fail-fast timeout.
    const normalized = raw.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false') {
        return false;
    }

    // Require a plain positive integer count of milliseconds. parseInt() is too lenient — it
    // reads "30s" as 30 (i.e. 30ms, off by 1000x) and "60000ms" as 60000 — so validate the raw
    // string first. Any other garbage (typo, negative, unit suffix) keeps the fail-fast default
    // rather than silently disabling the timeout, which would reintroduce the multi-minute hang.
    if (!/^\d+$/.test(normalized) || Number.parseInt(normalized, 10) <= 0) {
        console.warn(
            `[workflow] Invalid ${WORKFLOW_FETCH_TIMEOUT_ENV}="${raw}"; ` +
                `expected a positive integer in milliseconds. Falling back to ${DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS}ms`,
        );
        return DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS;
    }
    return Number.parseInt(normalized, 10);
}
