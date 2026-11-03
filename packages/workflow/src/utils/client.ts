/**
 * get a zeno client for a given token
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { Context } from '@temporalio/activity';
import type { FETCH_FN } from '@vertesia/api-fetch-client';
import { decodeEndpoints, decodeJWT, VertesiaClient, type VertesiaClientProps } from '@vertesia/client';
import type { WorkflowExecutionBaseParams, WorkflowJobDelegation } from '@vertesia/common';
import type { Dispatcher } from 'undici';
import { WorkflowParamNotFoundError } from '../errors.js';

const logicalOperation = new AsyncLocalStorage<string>();

export interface WorkflowJobTokenScope {
    accountId: string;
    projectId: string;
    grant: WorkflowJobDelegation;
    tokenServerUrl: string;
}
const delegatedJob = new AsyncLocalStorage<WorkflowJobTokenScope>();
export function withWorkflowJobDelegation<T>(scope: WorkflowJobTokenScope, action: () => T): T {
    return delegatedJob.run(scope, action);
}
let refreshJobToken: ((scope: WorkflowJobTokenScope) => Promise<string>) | undefined;
/** Workers install their attested, scope-preserving job-grant renewal provider. */
export function configureWorkflowJobTokenRefresh(provider: NonNullable<typeof refreshJobToken>): void {
    refreshJobToken = provider;
}

/**
 * Give a logical HTTP operation an identity stable across activity retries and continue-as-new.
 * Choose a separate key for each intended operation; this deduplicates quota debits, not writes.
 * The key must be scoped to the business operation (e.g. batch id + child id + phase).
 */
export function withWorkflowOperation<T>(operationId: string, operation: () => T): T {
    if (!operationId.trim()) throw new Error('A logical workflow operation ID is required');
    return logicalOperation.run(operationId, operation);
}

// Short default timeout for ordinary workflow -> server/store calls (object GETs, status updates,
// etc.). A stale/dead pooled connection (a server pod scaled down/rolled mid-request) should fail
// quickly so the activity can retry. The long path — synchronous interaction execution, which blocks
// on the model — sets its own long per-request timeout in @vertesia/client, overriding this.
// Override the default via VERTESIA_WORKFLOW_FETCH_TIMEOUT_MS (0/false disables it).
const DEFAULT_WORKFLOW_FETCH_TIMEOUT_MS = 60 * 1000;
const WORKFLOW_FETCH_TIMEOUT_ENV = 'VERTESIA_WORKFLOW_FETCH_TIMEOUT_MS';

// The API client already gives every finite request an explicit AbortSignal deadline. Disable
// undici's independent five-minute response timeout so it cannot terminate an admitted, cancellable
// activity request behind the deadline owner's back. One dispatcher is shared for the worker process.
let workflowDispatcher: Promise<Dispatcher> | undefined;

function getWorkflowDispatcher(): Promise<Dispatcher> {
    workflowDispatcher ??= import('undici')
        .then(({ EnvHttpProxyAgent }) => new EnvHttpProxyAgent({ headersTimeout: 0, bodyTimeout: 0 }))
        .catch((error: unknown) => {
            workflowDispatcher = undefined;
            throw error;
        });
    return workflowDispatcher;
}

type DispatcherRequestInit = RequestInit & { dispatcher: Dispatcher };

function combineSignals(requestSignal: AbortSignal | null, activitySignal?: AbortSignal): AbortSignal | undefined {
    if (!activitySignal) return requestSignal ?? undefined;
    if (!requestSignal) return activitySignal;
    return AbortSignal.any([requestSignal, activitySignal]);
}

// An aborted signal rejects with its reason — for the activity signal, a Temporal CancelledFailure.
// The API client recognises a caller abort only by the `AbortError` name or by its own request
// signal, which never carries the activity signal, so it would log a cancelled activity as a
// connection failure. Report the cancellation as an `AbortError` that keeps the reason as its cause.
function toActivityAbortError(err: unknown, activitySignal?: AbortSignal): unknown {
    if (!activitySignal?.aborted) return err;
    return new DOMException('The activity was cancelled', { name: 'AbortError', cause: activitySignal.reason });
}

function createWorkflowFetch(activitySignal?: AbortSignal): FETCH_FN {
    return async (input, init) => {
        const requestSignal = input instanceof Request ? input.signal : (init?.signal ?? null);
        const signal = combineSignals(requestSignal, activitySignal);
        try {
            signal?.throwIfAborted();
            const dispatcher = await getWorkflowDispatcher();
            signal?.throwIfAborted();
            return await globalThis.fetch(input, {
                ...init,
                dispatcher,
                signal,
            } as DispatcherRequestInit);
        } catch (err: unknown) {
            throw toActivityAbortError(err, activitySignal);
        }
    };
}

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
    // Normalize the token's endpoints claim (string | object) the same way the main client does.
    // Only decode when the claim is actually present: decodeEndpoints(undefined) returns the
    // PRODUCTION endpoint map (token: https://sts.vertesia.io), which would mask the tokenServerUrl
    // fallback below and mint against prod for a non-prod token. An empty map preserves the fallback
    // to `token.iss`.
    const tokenEndpoints = token.endpoints ? decodeEndpoints(token.endpoints) : {};

    let requestSequence = 0;
    let mutationSequence = 0;
    let requestPrefix: string | undefined;
    let logicalWorkflowId: string | undefined;
    let activitySignal: AbortSignal | undefined;
    let activityDeadline: number | undefined;
    let originalScheduledAt = Date.now();
    try {
        const context = Context.current();
        const info = context.info;
        originalScheduledAt = info.scheduledTimestampMs;
        const deadlines = [
            info.startToCloseTimeoutMs > 0
                ? info.currentAttemptScheduledTimestampMs + info.startToCloseTimeoutMs
                : Infinity,
            info.scheduleToCloseTimeoutMs > 0 ? info.scheduledTimestampMs + info.scheduleToCloseTimeoutMs : Infinity,
        ];
        if (Number.isFinite(Math.min(...deadlines))) activityDeadline = Math.min(...deadlines);
        activitySignal = context.cancellationSignal;
        const execution = info.workflowExecution;
        if (execution) {
            logicalWorkflowId = execution.workflowId;
            requestPrefix = `workflow:${execution.workflowId}:${execution.runId}:${info.activityId}`;
        }
    } catch {
        // Option construction is also used outside an activity by tests and utility callers.
    }

    const { account_id: accountId, project_id: projectId, auth_token: authToken } = payload;
    const mutationKey = () =>
        createHash('sha256')
            .update(
                JSON.stringify([
                    accountId,
                    projectId,
                    logicalWorkflowId,
                    logicalOperation.getStore() ?? `${requestPrefix}:${mutationSequence++}`,
                ]),
            )
            .digest('hex');
    return {
        serverUrl: payload.config.studio_url,
        storeUrl: payload.config.store_url,
        // Prefer the token's own endpoints.token (the mint host that issued it) and fall back to the
        // issuer only for legacy tokens without an endpoints claim — same resolution the main client
        // and tools-sdk use. This keeps `iss` as the stable identity (WIF/JWKS) while letting a branch
        // STS on its own host be the mint endpoint.
        tokenServerUrl: tokenEndpoints.token || token.iss,
        ...(delegatedJob.getStore() || token.workflow_job_delegation
            ? {
                  authCallback: jobAuthorization(
                      { account_id: accountId, project_id: projectId, auth_token: authToken },
                      tokenEndpoints.token || token.iss,
                      activitySignal,
                      activityDeadline,
                  ),
              }
            : { apikey: payload.auth_token }),
        timeout: parseWorkflowFetchTimeoutMs(),
        // Temporal owns pacing/quota waits, cancellation and the activity deadline.
        pacingRetry: false,
        retryPolicy: {
            attempts: 1,
            ...(requestPrefix
                ? {
                      idempotencyKeys: true,
                      idempotencyKey: mutationKey,
                      importId: () =>
                          Math.floor(originalScheduledAt / 1000)
                              .toString(16)
                              .padStart(8, '0') + mutationKey().slice(0, 16),
                  }
                : {}),
        },
        fetch: createWorkflowFetch(activitySignal),
        ...(requestPrefix
            ? {
                  onRequest: async (request: Request) => {
                      const bodyHash = createHash('sha256')
                          .update(
                              request.headers.get('content-type')?.includes('application/json')
                                  ? new Uint8Array(await request.clone().arrayBuffer())
                                  : '',
                          )
                          .digest('hex');
                      const operationId = logicalOperation.getStore();
                      const identity = operationId
                          ? `workflow:operation:${createHash('sha256')
                                .update(
                                    JSON.stringify([
                                        accountId,
                                        projectId,
                                        logicalWorkflowId,
                                        operationId,
                                        request.method,
                                        request.url,
                                        bodyHash,
                                    ]),
                                )
                                .digest('hex')}`
                          : `${requestPrefix}:${requestSequence++}:${createHash('sha256')
                                .update(JSON.stringify([request.method, request.url, bodyHash]))
                                .digest('hex')}`;
                      request.headers.set('x-request-id', identity);
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

function jobAuthorization(
    payload: Pick<WorkflowExecutionBaseParams<unknown>, 'account_id' | 'project_id' | 'auth_token'>,
    tokenServerUrl: string,
    signal?: AbortSignal,
    deadline?: number,
): () => Promise<string> {
    const override = delegatedJob.getStore();
    let current = override ? '' : (payload.auth_token ?? '');
    return async () => {
        if (!current && override) {
            if (!refreshJobToken) throw new Error('The worker has no workflow job-grant renewal provider');
            current = await waitForJobRefresh(refreshJobToken(override), signal, deadline);
        }
        const decoded = decodeJWT(current);
        if (!decoded.exp || decoded.exp * 1000 - Date.now() <= 60_000) {
            if (!refreshJobToken || !decoded.workflow_job_delegation)
                throw new Error('The worker has no workflow job-grant renewal provider');
            current = await waitForJobRefresh(
                refreshJobToken(
                    override ?? {
                        accountId: payload.account_id,
                        projectId: payload.project_id,
                        grant: decoded.workflow_job_delegation,
                        tokenServerUrl,
                    },
                ),
                signal,
                deadline,
            );
        }
        return `Bearer ${current}`;
    };
}

/** Cancel this waiter without cancelling a refresh shared by other activities. */
async function waitForJobRefresh(
    promise: Promise<string>,
    callerSignal?: AbortSignal,
    deadline?: number,
): Promise<string> {
    const requestTimeout = parseWorkflowFetchTimeoutMs();
    const duration = Math.min(
        requestTimeout === false ? Infinity : requestTimeout,
        deadline === undefined ? Infinity : Math.max(1, deadline - Date.now()),
    );
    const timeout = Number.isFinite(duration) ? AbortSignal.timeout(Math.ceil(duration)) : undefined;
    const signal = callerSignal && timeout ? AbortSignal.any([callerSignal, timeout]) : (callerSignal ?? timeout);
    if (!signal) return promise;
    signal.throwIfAborted();
    return new Promise<string>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        promise
            .then(resolve, reject)
            .finally(() => signal.removeEventListener('abort', abort))
            .catch(() => {});
    });
}
