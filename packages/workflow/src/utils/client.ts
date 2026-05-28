/**
 * get a zeno client for a given token
 */

import { decodeJWT, VertesiaClient, type VertesiaClientProps } from '@vertesia/client';
import type { FETCH_FN } from '@vertesia/api-fetch-client';
import type { WorkflowExecutionBaseParams } from '@vertesia/common';
import { Agent } from 'undici';
import { WorkflowParamNotFoundError } from '../errors.js';

const DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS = 30 * 60 * 1000;
const WORKFLOW_FETCH_TIMEOUT_ENV = 'VERTESIA_WORKFLOW_FETCH_TIMEOUT_MS';

let workflowFetch: Promise<FETCH_FN> | undefined;

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
        fetch: getWorkflowFetch(),
    };
}

function getWorkflowFetch(): Promise<FETCH_FN> {
    workflowFetch ??= createWorkflowFetch();
    return workflowFetch;
}

async function createWorkflowFetch(): Promise<FETCH_FN> {
    if (typeof globalThis.fetch !== 'function') {
        throw new Error('No Fetch implementation found');
    }

    const timeoutMs = parseWorkflowFetchTimeoutMs();
    if (timeoutMs === 0) {
        return globalThis.fetch.bind(globalThis);
    }

    const dispatcher = new Agent({
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
    });

    return (input, init) =>
        globalThis.fetch(input, {
            ...init,
            dispatcher,
        } as unknown as RequestInit);
}

function parseWorkflowFetchTimeoutMs(): number {
    const raw = process.env[WORKFLOW_FETCH_TIMEOUT_ENV];
    if (!raw) {
        return DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS;
    }
    return parsed;
}
