import { AsyncExecutionPayload, ExecutionRunStatus, InteractionExecutionPayload, InteractionExecutionResult, NamedInteractionExecutionPayload, RateLimitRequestPayload, RateLimitRequestResponse } from '@vertesia/common';
import { VertesiaClient } from './client.js';

export async function EventSourceProvider(): Promise<typeof EventSource> {
    if (typeof globalThis.EventSource === 'function') {
        return globalThis.EventSource;
    } else {
        return (await import('eventsource')).EventSource;
    }
}
/**
 *
 * Execute an interaction and return a promise which will be resolved with the executed run when
 * the run completes or fails.
 * If the onChunk callback is passed then the streaming of the result is enabled.
 * The onChunk callback with be called with the next chunk of the result as soon as it is available.
 * When all chunks are received the function will return the resolved promise
 * @param id of the interaction to execute
 * @param payload InteractionExecutionPayload
 * @param onChunk callback to be called when the next chunk of the response is available
 */
export async function executeInteraction<P = any>(client: VertesiaClient,
    interactionId: string,
    payload: InteractionExecutionPayload = {},
    onChunk?: (chunk: string) => void): Promise<InteractionExecutionResult<P>> {
    const stream = !!onChunk;
    const response = await client.runs.create({
        ...payload, interaction: interactionId, stream
    });
    if (stream) {
        if (response.status === ExecutionRunStatus.failed) {
            return response;
        }
        await handleStreaming(client, response.id, onChunk);
    }
    return response;
}

/**
 * Same as executeInteraction but uses the interaction name selector instead of the id.
 * A name selector is the interaction endpoint name suffixed with an optional tag or version which is starting with a `@` character.
 * The special `draft` tag is used to select the draft version of the interaction. If no tag or version is specified then the latest version is selected.
 * Examples of selectors:
 * - `ReviewContract` - select the latest version of the ReviewContract interaction
 * - `ReviewContract@1` - select the version 1 of the ReviewContract interaction
 * - `ReviewContract@draft` - select the draft version of the ReviewContract interaction
 * - `ReviewContract@fixed` - select the ReviewContract interaction which is tagged with 'fixed' tag.
 *
 * @param client
 * @param interaction
 * @param payload
 * @param onChunk
 * @returns
 */
export async function executeInteractionByName<P = any>(client: VertesiaClient,
    interaction: string,
    payload: InteractionExecutionPayload = {},
    onChunk?: (chunk: string) => void): Promise<InteractionExecutionResult<P>> {
    const stream = !!onChunk;
    const response = await client.post('/api/v1/execute', {
        payload: {
            ...payload,
            interaction,
            stream
        } as NamedInteractionExecutionPayload,
    });
    if (stream) {
        if (response.status === ExecutionRunStatus.failed) {
            return response;
        }
        await handleStreaming(client, response.id, onChunk);
    }
    return response;
}

function handleStreaming(client: VertesiaClient, runId: string, onChunk: (chunk: string) => void) {
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                const EventSourceImpl = await EventSourceProvider();
                const streamUrl = new URL(client.runs.baseUrl + '/' + runId + '/stream');
                const bearerToken = client._auth ? await client._auth() : undefined;

                if (bearerToken) {
                    const token = bearerToken.split(' ')[1];
                    streamUrl.searchParams.set('access_token', token);
                } else {
                    throw new Error('No auth token available');
                }

                const sse = new EventSourceImpl(streamUrl.href);
                sse.addEventListener("message", ev => {
                    try {
                        const data = JSON.parse(ev.data);
                        if (data) {
                            onChunk && onChunk(data);
                        }
                    } catch (err) {
                        reject(err);
                    }
                });
                sse.addEventListener("close", (ev) => {
                    try {
                        sse.close();
                        const msg = JSON.parse(ev.data)
                        resolve(msg);
                    } catch (err) {
                        reject(err);
                    }
                });
            } catch (err) {
                reject(err);
            }
        })();
    });
}

export async function executeInteractionAsync(client: VertesiaClient, payload: AsyncExecutionPayload): Promise<{ runId: string, workflowId: string }> {
    return await client.post('/api/v1/execute/async', {
        payload,
    });
}

export async function checkRateLimit(client: VertesiaClient, payload: RateLimitRequestPayload): Promise<RateLimitRequestResponse> {
    return await client.post('/api/v1/execute/rate-limit/request', {
        payload
    });
}