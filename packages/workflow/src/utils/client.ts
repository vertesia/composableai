/**
 * get a zeno client for a given token
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { Context } from '@temporalio/activity';
import type { FETCH_FN } from '@vertesia/api-fetch-client';
import { decodeEndpoints, decodeJWT, VertesiaClient, type VertesiaClientProps } from '@vertesia/client';
import { PrincipalType, type WorkflowExecutionBaseParams } from '@vertesia/common';
import type { Dispatcher } from 'undici';
import { WorkflowParamNotFoundError } from '../errors.js';

const logicalOperation = new AsyncLocalStorage<{
    id: string;
    createdAtMs?: number;
    requestOccurrences: Map<string, number>;
}>();
const workflowHttpExecution = new AsyncLocalStorage<{
    requestOccurrences: Map<string, number>;
    mutationSequence: number;
}>();
/** Install around one activity attempt only when a durable quota retry interceptor owns its waits. */
export function withWorkflowHttpExecution<T>(action: () => T): T {
    return workflowHttpExecution.run({ requestOccurrences: new Map<string, number>(), mutationSequence: 0 }, action);
}

/**
 * Give a logical HTTP operation an identity stable across activity retries and continue-as-new.
 * Choose a separate key for each intended operation; server trust and endpoint idempotency still apply.
 * The key must be scoped to the business operation (e.g. batch id + child id + phase).
 * Request bodies must serialize identically on every retry, including named operations. Persist timestamps
 * and generated values in workflow state/input; changing the body intentionally creates a new identity.
 * Named data imports also require a retained createdAtMs (or an explicit import_id) across runs.
 */
export function withWorkflowOperation<T>(
    operationId: string,
    operation: () => T,
    options: { createdAtMs?: number } = {},
): T {
    if (!operationId.trim()) throw new Error('A logical workflow operation ID is required');
    if (
        options.createdAtMs !== undefined &&
        (!Number.isFinite(options.createdAtMs) || options.createdAtMs < 0 || options.createdAtMs >= 0x100000000 * 1000)
    )
        throw new Error('Operation createdAtMs must be an ObjectId-compatible timestamp');
    return logicalOperation.run(
        { id: operationId, createdAtMs: options.createdAtMs, requestOccurrences: new Map() },
        operation,
    );
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

    const httpExecution = workflowHttpExecution.getStore();
    const counters = httpExecution ?? { requestOccurrences: new Map<string, number>(), mutationSequence: 0 };
    let requestPrefix: string | undefined;
    let logicalWorkflowId: string | undefined;
    let activitySignal: AbortSignal | undefined;
    let originalScheduledAt = Date.now();
    try {
        const context = Context.current();
        const info = context.info;
        originalScheduledAt = info.scheduledTimestampMs;
        activitySignal = context.cancellationSignal;
        const execution = info.workflowExecution;
        if (execution) {
            logicalWorkflowId = execution.workflowId;
            requestPrefix = `workflow:${execution.workflowId}:${execution.runId}:${info.activityId}`;
        }
    } catch {
        // Option construction is also used outside an activity by tests and utility callers.
    }

    const { account_id: accountId, project_id: projectId } = payload;
    const mutationKey = (operationPayload?: unknown) =>
        createHash('sha256')
            .update(
                JSON.stringify([
                    accountId,
                    projectId,
                    logicalWorkflowId,
                    logicalOperation.getStore()?.id ?? `${requestPrefix}:${counters.mutationSequence++}`,
                    operationPayload,
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
        apikey: payload.auth_token,
        timeout: parseWorkflowFetchTimeoutMs(),
        // Public workers retain SDK defaults. The activity owner opts into durable retries explicitly.
        ...(httpExecution
            ? {
                  pacingRetry: false,
                  retryPolicy: {
                      attempts: 1,
                      ...(requestPrefix
                          ? {
                                idempotencyKeys: true,
                                idempotencyKey: mutationKey,
                                importId: (operationPayload?: unknown) => {
                                    const operation = logicalOperation.getStore();
                                    if (operation && operation.createdAtMs === undefined)
                                        throw new Error(
                                            'Named imports require a stable createdAtMs or an explicit import_id',
                                        );
                                    return (
                                        Math.floor((operation?.createdAtMs ?? originalScheduledAt) / 1000)
                                            .toString(16)
                                            .padStart(8, '0') + mutationKey(operationPayload).slice(0, 16)
                                    );
                                },
                            }
                          : {}),
                  },
              }
            : {}),
        fetch: createWorkflowFetch(activitySignal),
        ...(requestPrefix &&
        httpExecution &&
        token.trusted_request_identity === true &&
        token.type === PrincipalType.ServiceAccount
            ? {
                  requestIdentity: ({ url, method, body }) => {
                      const operationId = logicalOperation.getStore()?.id;
                      // Body is already serialized by the HTTP client; never clone/buffer a Request.
                      const bodyHash = createHash('sha256')
                          .update(typeof body === 'string' ? body : '')
                          .digest('hex');
                      const fingerprint = createHash('sha256')
                          .update(
                              JSON.stringify([
                                  accountId,
                                  projectId,
                                  operationId ? logicalWorkflowId : requestPrefix,
                                  operationId,
                                  method,
                                  url,
                                  bodyHash,
                              ]),
                          )
                          .digest('hex');
                      const occurrences =
                          logicalOperation.getStore()?.requestOccurrences ?? counters.requestOccurrences;
                      const occurrence = occurrences.get(fingerprint) ?? 0;
                      occurrences.set(fingerprint, occurrence + 1);
                      return `workflow:operation:${createHash('sha256').update(`${fingerprint}:${occurrence}`).digest('hex')}`;
                  },
              }
            : requestPrefix
              ? {
                    // Correlation is useful for every activity, even without attested quota identity.
                    // Only the trusted path above hashes bodies for replay identity.
                    requestIdentity: () => `${requestPrefix}:${counters.mutationSequence++}`,
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
